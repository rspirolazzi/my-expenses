"""Accounts: creation, editing, participants, leaving, invite code, closing and deletion."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core import errors
from app.core.errors import AppError
from app.db.client import run_in_transaction
from app.repositories import accounts, expenses
from app.schemas.account import (
    MAX_PARTICIPANTS,
    AccountCreate,
    AccountResponse,
    AccountSummary,
    AccountUpdate,
    name_key,
)
from app.schemas.expense import ParticipantImpact
from app.services import audit_service, expense_service
from app.services.account_permissions import (
    active_participants,
    is_owner,
    my_participant,
    require_member,
    require_open,
    require_owner,
    to_account_response,
    to_account_summary,
)

# Writes only apply to accounts that are still open and not deleted.
OPEN = {"isClosed": False, "isDeleted": False}


async def _audit(
    action: audit_service.AuditAction,
    user_id: ObjectId,
    account_id: ObjectId,
    changes: dict[str, Any],
    client: str,
    session: AsyncClientSession,
) -> None:
    await audit_service.record(
        action,
        actor_user_id=user_id,
        entity_id=account_id,
        changes=changes,
        metadata={"client": client},
        session=session,
        entity_type="account",
        account_id=account_id,
    )


async def _explain_failed_write(account_id: ObjectId, user_id: ObjectId) -> None:
    """A conditional write matched nothing: report why, re-reading the current state."""
    doc = await require_member(account_id, user_id)
    require_open(doc)


def _find_active(doc: dict[str, Any], participant_id: str) -> dict[str, Any]:
    participant = next((p for p in active_participants(doc) if p["id"] == participant_id), None)
    if participant is None:
        raise AppError(404, errors.NOT_FOUND)
    return participant


def _ensure_unique(doc: dict[str, Any], name: str, except_id: str | None = None) -> str:
    key = name_key(name)
    if any(p["nameKey"] == key and p["id"] != except_id for p in active_participants(doc)):
        raise AppError(422, errors.DUPLICATE_PARTICIPANT_NAME)
    return key


def _ensure_room(doc: dict[str, Any]) -> None:
    if len(active_participants(doc)) >= MAX_PARTICIPANTS:
        raise AppError(422, errors.VALIDATION_ERROR)


def _no_active_name(key: str, except_id: str | None = None) -> dict[str, Any]:
    match: dict[str, Any] = {"nameKey": key, "removedAt": None}
    if except_id is not None:
        match["id"] = {"$ne": except_id}
    return {"participants": {"$not": {"$elemMatch": match}}}


# --- US1 ----------------------------------------------------------------------------------------


async def create_account(user_id: ObjectId, request: AccountCreate, client: str) -> AccountResponse:
    names = [request.my_participant_name, *request.other_participants]
    if len({name_key(n) for n in names}) != len(names):
        raise AppError(422, errors.DUPLICATE_PARTICIPANT_NAME)
    participants = [accounts.new_participant(request.my_participant_name, user_id)]
    participants += [accounts.new_participant(name) for name in request.other_participants]
    doc = accounts.new_account_document(
        name=request.name,
        description=request.description,
        icon=request.icon,
        currency=request.currency,
        owner_id=user_id,
        participants=participants,
    )

    async def write(session: AsyncClientSession) -> None:
        doc["_id"] = await accounts.insert(doc, session=session)
        await _audit(
            "account.created",
            user_id,
            doc["_id"],
            {
                "name": {"after": doc["name"]},
                "currency": {"after": doc["currency"]},
                "icon": {"after": doc["icon"]},
                "participants": {"after": names},
            },
            client,
            session,
        )

    await run_in_transaction(write)
    return to_account_response(doc, user_id)


async def list_my_accounts(user_id: ObjectId) -> list[AccountSummary]:
    return [to_account_summary(doc, user_id) for doc in await accounts.list_for_member(user_id)]


async def get_account(account_id: str, user_id: ObjectId) -> AccountResponse:
    return to_account_response(await require_member(account_id, user_id), user_id)


# --- US3 ----------------------------------------------------------------------------------------


async def update_account(
    account_id: str, user_id: ObjectId, request: AccountUpdate, client: str
) -> AccountResponse:
    doc = await require_member(account_id, user_id)
    require_open(doc)
    sent = request.model_fields_set
    fields: dict[str, Any] = {}
    for attr in ("name", "description", "icon"):
        if attr in sent:
            value = getattr(request, attr)
            if value is None and attr != "description":
                continue  # name and icon cannot be cleared
            if doc.get(attr) != value:
                fields[attr] = value
    if not fields:
        return to_account_response(doc, user_id)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"], {"$set": fields}, session=session, extra_filter=OPEN
        )
        if updated is not None:
            changes = {k: {"before": doc.get(k), "after": v} for k, v in fields.items()}
            await _audit("account.updated", user_id, doc["_id"], changes, client, session)
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        await _explain_failed_write(doc["_id"], user_id)
        raise AppError(409, errors.ACCOUNT_CLOSED)
    return to_account_response(updated, user_id)


async def add_participant(
    account_id: str, user_id: ObjectId, name: str, client: str
) -> AccountResponse:
    doc = await require_member(account_id, user_id)
    require_open(doc)
    key = _ensure_unique(doc, name)
    _ensure_room(doc)
    participant = accounts.new_participant(name)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {"$push": {"participants": participant}},
            session=session,
            extra_filter={**OPEN, **_no_active_name(key)},
        )
        if updated is not None:
            changes = {
                "participant": {"after": {"id": participant["id"], "name": participant["name"]}}
            }
            await _audit("account.participant_added", user_id, doc["_id"], changes, client, session)
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        current = await require_member(doc["_id"], user_id)
        require_open(current)
        _ensure_unique(current, name)
        raise AppError(409, errors.ACCOUNT_CLOSED)
    return to_account_response(updated, user_id)


async def rename_participant(
    account_id: str, user_id: ObjectId, participant_id: str, name: str, client: str
) -> AccountResponse:
    doc = await require_member(account_id, user_id)
    require_open(doc)
    participant = _find_active(doc, participant_id)
    key = _ensure_unique(doc, name, except_id=participant_id)
    if participant["name"] == name.strip():
        return to_account_response(doc, user_id)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {"$set": {"participants.$[p].name": name.strip(), "participants.$[p].nameKey": key}},
            session=session,
            extra_filter={**OPEN, **_no_active_name(key, except_id=participant_id)},
            array_filters=[{"p.id": participant_id, "p.removedAt": None}],
        )
        if updated is not None:
            changes = {
                f"participant.{participant_id}.name": {
                    "before": participant["name"],
                    "after": name.strip(),
                }
            }
            await _audit(
                "account.participant_renamed", user_id, doc["_id"], changes, client, session
            )
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        current = await require_member(doc["_id"], user_id)
        require_open(current)
        _find_active(current, participant_id)
        _ensure_unique(current, name, except_id=participant_id)
        raise AppError(409, errors.ACCOUNT_CLOSED)
    return to_account_response(updated, user_id)


async def remove_participant(
    account_id: str, user_id: ObjectId, participant_id: str, client: str
) -> AccountResponse:
    """Logical removal (research R3): the participant keeps its name for the history."""
    doc = await require_member(account_id, user_id)
    require_open(doc)
    participant = _find_active(doc, participant_id)
    if participant.get("userId") == doc["ownerId"]:
        raise AppError(409, errors.OWNER_PARTICIPANT)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {
                "$set": {
                    "participants.$[p].removedAt": datetime.now(UTC),
                    "participants.$[p].userId": None,
                }
            },
            session=session,
            extra_filter=OPEN,
            array_filters=[{"p.id": participant_id, "p.removedAt": None}],
        )
        if updated is not None:
            changes = {
                "participant": {
                    "before": {
                        "id": participant_id,
                        "name": participant["name"],
                        "userId": participant.get("userId"),
                    }
                }
            }
            await _audit(
                "account.participant_removed", user_id, doc["_id"], changes, client, session
            )
            # Its expenses are adjusted in the same transaction (FR-020 to FR-023, research R9).
            await expense_service.adjust_for_removed_participant(
                doc, participant_id, user_id, client, session
            )
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        await _explain_failed_write(doc["_id"], user_id)
        raise AppError(409, errors.ACCOUNT_CLOSED)
    # The member who removed themselves this way is no longer a member.
    if my_participant(updated, user_id) is None:
        raise AppError(404, errors.NOT_FOUND)
    return to_account_response(updated, user_id)


async def participant_impact(
    account_id: str, user_id: ObjectId, participant_id: str
) -> ParticipantImpact:
    """How many active expenses removing this participant would change (FR-022)."""
    doc = await require_member(account_id, user_id)
    _find_active(doc, participant_id)
    return ParticipantImpact(
        affected_expenses=await expenses.count_affected_by_participant(doc["_id"], participant_id)
    )


# --- US4 ----------------------------------------------------------------------------------------


async def leave_account(account_id: str, user_id: ObjectId, client: str) -> None:
    doc = await require_member(account_id, user_id)
    if is_owner(doc, user_id):
        raise AppError(403, errors.OWNER_CANNOT_LEAVE)
    require_open(doc)
    participant = my_participant(doc, user_id)
    assert participant is not None

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {"$set": {"participants.$[p].userId": None}},
            session=session,
            extra_filter=OPEN,
            array_filters=[{"p.id": participant["id"], "p.userId": user_id}],
        )
        if updated is not None:
            changes = {
                f"participant.{participant['id']}.userId": {"before": user_id, "after": None}
            }
            await _audit("account.member_left", user_id, doc["_id"], changes, client, session)
        return updated

    if await run_in_transaction(write) is None:
        await _explain_failed_write(doc["_id"], user_id)
        raise AppError(409, errors.ACCOUNT_CLOSED)


# --- US2 (Owner part) ---------------------------------------------------------------------------


async def regenerate_invite_code(
    account_id: str, user_id: ObjectId, client: str
) -> AccountResponse:
    doc = await require_member(account_id, user_id)
    require_owner(doc, user_id)
    require_open(doc)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {"$set": {"inviteCode": accounts.new_invite_code()}},
            session=session,
            extra_filter=OPEN,
        )
        if updated is not None:
            # The code itself is an access secret and never goes to the audit log.
            changes = {"invitation": {"after": "regenerated"}}
            await _audit(
                "account.invite_regenerated", user_id, doc["_id"], changes, client, session
            )
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        raise AppError(409, errors.ACCOUNT_CLOSED)
    return to_account_response(updated, user_id)


# --- US5 ----------------------------------------------------------------------------------------


async def close_account(account_id: str, user_id: ObjectId, client: str) -> AccountResponse:
    """Closing is final: there is no operation to reopen an account."""
    doc = await require_member(account_id, user_id)
    require_owner(doc, user_id)
    require_open(doc)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {"$set": {"isClosed": True, "closedAt": datetime.now(UTC)}},
            session=session,
            extra_filter=OPEN,
        )
        if updated is not None:
            changes = {"isClosed": {"before": False, "after": True}}
            await _audit("account.closed", user_id, doc["_id"], changes, client, session)
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        raise AppError(409, errors.ACCOUNT_CLOSED)
    return to_account_response(updated, user_id)


async def delete_account(account_id: str, user_id: ObjectId, client: str) -> None:
    """Logical deletion by the Owner, also for closed accounts; data is kept."""
    doc = await require_member(account_id, user_id)
    require_owner(doc, user_id)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"],
            {"$set": {"isDeleted": True, "deletedAt": datetime.now(UTC)}},
            session=session,
            extra_filter={"isDeleted": False},
        )
        if updated is not None:
            changes = {"isDeleted": {"before": False, "after": True}}
            await _audit("account.deleted", user_id, doc["_id"], changes, client, session)
        return updated

    if await run_in_transaction(write) is None:
        raise AppError(404, errors.NOT_FOUND)
