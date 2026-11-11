"""Expenses: create, list with total, detail, edit and logical delete (research R1–R10).

Application logs never include titles, descriptions, amounts or names (Principle VI).
"""

import base64
import binascii
import json
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.errors import DuplicateKeyError

from app.core import errors
from app.core.errors import AppError
from app.core.money import InvalidAmount, format_amount, parse_amount, split_equal
from app.db.client import run_in_transaction
from app.repositories import accounts, expenses
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseListItem,
    ExpensePage,
    ExpenseResponse,
    ExpenseUpdate,
    ExpenseWrite,
    ParticipantRef,
    ShareResponse,
)
from app.services import audit_service
from app.services.account_permissions import (
    active_participants,
    my_participant,
    require_member,
    require_open,
)

# Fields compared and audited on every write (research R8).
AUDITED_FIELDS = (
    "date",
    "title",
    "description",
    "amountMinor",
    "currency",
    "paidById",
    "participantIds",
    "categoryIcon",
)


# --- Views ----------------------------------------------------------------------------------------


def _names(account: dict[str, Any]) -> dict[str, str]:
    """All participants, removed ones included, so history keeps their names."""
    return {p["id"]: p["name"] for p in account["participants"]}


def _ref(account: dict[str, Any], participant_id: str | None) -> ParticipantRef | None:
    if participant_id is None:
        return None
    return ParticipantRef(id=participant_id, name=_names(account).get(participant_id, ""))


def is_pending(doc: dict[str, Any]) -> bool:
    return doc.get("paidById") is None or not doc.get("participantIds")


def to_expense_response(doc: dict[str, Any], account: dict[str, Any]) -> ExpenseResponse:
    order = [p["id"] for p in account["participants"]]
    shares = split_equal(doc["amountMinor"], doc["participantIds"], order)
    return ExpenseResponse(
        id=str(doc["_id"]),
        account_id=str(doc["accountId"]),
        date=doc["date"],
        title=doc["title"],
        description=doc.get("description"),
        amount=format_amount(doc["amountMinor"], doc["currency"]),
        currency=doc["currency"],
        category_icon=doc["categoryIcon"],
        paid_by=_ref(account, doc.get("paidById")),
        participants=[_ref(account, pid) for pid in doc["participantIds"]],
        shares=[
            ShareResponse(
                participant=_ref(account, pid), amount=format_amount(minor, doc["currency"])
            )
            for pid, minor in shares.items()
        ],
        is_pending=is_pending(doc),
        version=doc["version"],
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
    )


def to_list_item(doc: dict[str, Any], account: dict[str, Any]) -> ExpenseListItem:
    return ExpenseListItem(
        id=str(doc["_id"]),
        date=doc["date"],
        title=doc["title"],
        category_icon=doc["categoryIcon"],
        amount=format_amount(doc["amountMinor"], doc["currency"]),
        paid_by=_ref(account, doc.get("paidById")),
        is_pending=is_pending(doc),
    )


# --- Validation -----------------------------------------------------------------------------------


def _validated_fields(request: ExpenseWrite, account: dict[str, Any]) -> dict[str, Any]:
    """Amount against the account currency and payer/participants against active ones (R10)."""
    try:
        amount_minor = parse_amount(request.amount, account["currency"])
    except InvalidAmount as exc:
        raise AppError(422, errors.VALIDATION_ERROR) from exc
    active = {p["id"] for p in active_participants(account)}
    if request.paid_by_id not in active or any(p not in active for p in request.participant_ids):
        raise AppError(422, errors.INVALID_PARTICIPANT)
    return {
        "date": request.date.isoformat(),
        "title": request.title,
        "description": request.description,
        "amountMinor": amount_minor,
        "paidById": request.paid_by_id,
        "participantIds": expenses.order_participants(request.participant_ids, account),
        "categoryIcon": request.category_icon,
    }


async def _guard(account_id: ObjectId, fields: dict[str, Any], session: AsyncClientSession) -> bool:
    return await accounts.guard_expense_write(
        account_id, [fields["paidById"], *fields["participantIds"]], session
    )


async def _explain_guard_failure(account_id: ObjectId, user_id: ObjectId, request: ExpenseWrite):
    """The guard did not match: re-read to report closed, gone or invalid participant."""
    account = await require_member(account_id, user_id)
    require_open(account)
    _validated_fields(request, account)
    raise AppError(422, errors.INVALID_PARTICIPANT)


def diff_expense(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """{field: {before, after}} for the audited fields that changed."""
    return {
        field: {"before": before.get(field), "after": after.get(field)}
        for field in AUDITED_FIELDS
        if before.get(field) != after.get(field)
    }


async def _audit(
    action: audit_service.AuditAction,
    *,
    user_id: ObjectId,
    account: dict[str, Any],
    expense_id: ObjectId,
    changes: dict[str, Any],
    client: str,
    session: AsyncClientSession,
    reason: str | None = None,
) -> None:
    mine = my_participant(account, user_id)
    metadata: dict[str, Any] = {
        "client": client,
        "actorParticipantId": mine["id"] if mine else None,
    }
    if reason is not None:
        metadata["reason"] = reason
    await audit_service.record(
        action,
        actor_user_id=user_id,
        entity_id=expense_id,
        changes=changes,
        metadata=metadata,
        session=session,
        entity_type="expense",
        account_id=account["_id"],
    )


# --- Participant removal (research R9) ------------------------------------------------------------


async def adjust_for_removed_participant(
    account: dict[str, Any],
    participant_id: str,
    user_id: ObjectId,
    client: str,
    session: AsyncClientSession,
) -> int:
    """Empty the payer and drop the participant from each active expense; audit each change.

    Runs inside the removal's transaction, so the removal and every adjustment apply together.
    """
    affected = await expenses.find_affected_by_participant(account["_id"], participant_id, session)
    for before in affected:
        after = await expenses.apply_participant_removal(before, participant_id, session)
        if after is None:
            continue
        await _audit(
            "expense.updated",
            user_id=user_id,
            account=account,
            expense_id=before["_id"],
            changes=diff_expense(before, after),
            client=client,
            session=session,
            reason="participant_removed",
        )
    return len(affected)


# --- Create and read ------------------------------------------------------------------------------


async def create_expense(
    account_id: str, user_id: ObjectId, request: ExpenseCreate, client: str
) -> ExpenseResponse:
    account = await require_member(account_id, user_id)
    require_open(account)
    client_request_id = str(request.client_request_id)
    existing = await expenses.find_by_client_request(account["_id"], client_request_id)
    if existing is not None:
        return to_expense_response(existing, account)
    fields = _validated_fields(request, account)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        if not await _guard(account["_id"], fields, session):
            return None
        doc = expenses.new_expense_document(
            account=account,
            expense_date=request.date,
            title=fields["title"],
            description=fields["description"],
            amount_minor=fields["amountMinor"],
            paid_by_id=fields["paidById"],
            participant_ids=fields["participantIds"],
            category_icon=fields["categoryIcon"],
            created_by=user_id,
            client_request_id=client_request_id,
        )
        doc["_id"] = await expenses.insert(doc, session=session)
        changes = {field: {"after": doc[field]} for field in AUDITED_FIELDS}
        await _audit(
            "expense.created",
            user_id=user_id,
            account=account,
            expense_id=doc["_id"],
            changes=changes,
            client=client,
            session=session,
        )
        return doc

    try:
        doc = await run_in_transaction(write)
    except DuplicateKeyError:
        # A concurrent retry with the same clientRequestId won (research R7).
        doc = await expenses.find_by_client_request(account["_id"], client_request_id)
        if doc is None:
            raise
    if doc is None:
        await _explain_guard_failure(account["_id"], user_id, request)
    return to_expense_response(doc, await require_member(account["_id"], user_id))


async def get_expense(account_id: str, expense_id: str, user_id: ObjectId) -> ExpenseResponse:
    account = await require_member(account_id, user_id)
    doc = await expenses.find_active(account["_id"], expense_id)
    if doc is None:
        raise AppError(404, errors.NOT_FOUND)
    return to_expense_response(doc, account)


# --- List -----------------------------------------------------------------------------------------


def _encode_cursor(doc: dict[str, Any]) -> str:
    raw = json.dumps([doc["date"], doc["createdAt"].isoformat(), str(doc["_id"])])
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, datetime, ObjectId]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        day, created_at, oid = json.loads(base64.urlsafe_b64decode(padded.encode()))
        return str(day), datetime.fromisoformat(created_at), ObjectId(oid)
    except (ValueError, TypeError, binascii.Error, InvalidId) as exc:
        raise AppError(422, errors.VALIDATION_ERROR) from exc


async def list_expenses(
    account_id: str, user_id: ObjectId, limit: int, cursor: str | None
) -> ExpensePage:
    account = await require_member(account_id, user_id)
    after = _decode_cursor(cursor) if cursor else None
    docs = await expenses.page(account["_id"], limit + 1, after)
    has_more = len(docs) > limit
    docs = docs[:limit]
    total: str | None = None
    count: int | None = None
    if cursor is None:
        total_minor, count = await expenses.totals(account["_id"])
        total = format_amount(total_minor, account["currency"])
    return ExpensePage(
        items=[to_list_item(doc, account) for doc in docs],
        next_cursor=_encode_cursor(docs[-1]) if has_more and docs else None,
        total=total,
        count=count,
    )


# --- Update and delete ----------------------------------------------------------------------------


async def _raise_conflict_or_gone(account: dict[str, Any], expense_id: str) -> None:
    current = await expenses.find_active(account["_id"], expense_id)
    if current is None:
        raise AppError(404, errors.NOT_FOUND)
    raise AppError(
        409,
        errors.EXPENSE_CONFLICT,
        extra={
            "current": to_expense_response(current, account).model_dump(mode="json", by_alias=True)
        },
    )


async def update_expense(
    account_id: str, expense_id: str, user_id: ObjectId, request: ExpenseUpdate, client: str
) -> ExpenseResponse:
    account = await require_member(account_id, user_id)
    require_open(account)
    before = await expenses.find_active(account["_id"], expense_id)
    if before is None:
        raise AppError(404, errors.NOT_FOUND)
    fields = _validated_fields(request, account)

    async def write(session: AsyncClientSession) -> tuple[str, dict[str, Any] | None]:
        if not await _guard(account["_id"], fields, session):
            return "guard", None
        updated = await expenses.update_versioned(
            account["_id"], before["_id"], request.version, fields, session=session
        )
        if updated is None:
            return "version", None
        await _audit(
            "expense.updated",
            user_id=user_id,
            account=account,
            expense_id=before["_id"],
            changes=diff_expense(before, updated),
            client=client,
            session=session,
        )
        return "ok", updated

    outcome, updated = await run_in_transaction(write)
    if outcome == "guard":
        await _explain_guard_failure(account["_id"], user_id, request)
    if updated is None:
        await _raise_conflict_or_gone(await require_member(account["_id"], user_id), expense_id)
    return to_expense_response(updated, await require_member(account["_id"], user_id))


async def delete_expense(
    account_id: str, expense_id: str, user_id: ObjectId, version: int, client: str
) -> None:
    account = await require_member(account_id, user_id)
    require_open(account)
    before = await expenses.find_active(account["_id"], expense_id)
    if before is None:
        raise AppError(404, errors.NOT_FOUND)

    async def write(session: AsyncClientSession) -> str:
        if not await accounts.guard_expense_write(account["_id"], [], session):
            return "guard"
        deleted = await expenses.update_versioned(
            account["_id"],
            before["_id"],
            version,
            {"isDeleted": True, "deletedAt": datetime.now(before["createdAt"].tzinfo)},
            session=session,
        )
        if deleted is None:
            return "version"
        await _audit(
            "expense.deleted",
            user_id=user_id,
            account=account,
            expense_id=before["_id"],
            changes={"isDeleted": {"before": False, "after": True}},
            client=client,
            session=session,
        )
        return "ok"

    outcome = await run_in_transaction(write)
    if outcome == "guard":
        require_open(await require_member(account["_id"], user_id))
    if outcome != "ok":
        await _raise_conflict_or_gone(await require_member(account["_id"], user_id), expense_id)
