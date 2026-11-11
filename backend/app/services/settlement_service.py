"""Settlements: idempotent create, list and logical delete (research R4, R5).

Every write goes through `guard_money_write` and records its audit entry in the same
transaction. Application logs never include amounts or names (Principle VI).
"""

from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.errors import DuplicateKeyError

from app.core import errors
from app.core.cursor import decode_cursor, encode_cursor
from app.core.errors import AppError
from app.core.money import InvalidAmount, format_amount, parse_amount
from app.db.client import run_in_transaction
from app.repositories import accounts, settlements
from app.schemas.expense import ParticipantRef
from app.schemas.settlement import SettlementCreate, SettlementPage, SettlementResponse
from app.services import audit_service
from app.services.account_permissions import (
    active_participants,
    my_participant,
    require_member,
    require_open,
)

# Fields recorded in settlement.created.
AUDITED_FIELDS = ("date", "fromParticipantId", "toParticipantId", "amountMinor", "currency")


# --- Views ----------------------------------------------------------------------------------------


def to_settlement_response(doc: dict[str, Any], account: dict[str, Any]) -> SettlementResponse:
    """Names come from every participant, removed ones included, so history keeps them."""
    names = {p["id"]: p["name"] for p in account["participants"]}
    active = {p["id"] for p in active_participants(account)}
    from_id, to_id = doc["fromParticipantId"], doc["toParticipantId"]
    return SettlementResponse(
        id=str(doc["_id"]),
        account_id=str(doc["accountId"]),
        date=doc["date"],
        from_=ParticipantRef(id=from_id, name=names.get(from_id, "")),
        to=ParticipantRef(id=to_id, name=names.get(to_id, "")),
        amount=format_amount(doc["amountMinor"], doc["currency"]),
        currency=doc["currency"],
        is_excluded=from_id not in active or to_id not in active,
        created_at=doc["createdAt"],
    )


# --- Validation and audit -------------------------------------------------------------------------


def _amount_minor(request: SettlementCreate, account: dict[str, Any]) -> int:
    try:
        return parse_amount(request.amount, account["currency"])
    except InvalidAmount as exc:
        raise AppError(422, errors.VALIDATION_ERROR) from exc


def _require_active_sides(request: SettlementCreate, account: dict[str, Any]) -> None:
    active = {p["id"] for p in active_participants(account)}
    if request.from_participant_id not in active or request.to_participant_id not in active:
        raise AppError(422, errors.INVALID_PARTICIPANT)


async def _audit(
    action: audit_service.AuditAction,
    *,
    user_id: ObjectId,
    account: dict[str, Any],
    settlement_id: ObjectId,
    changes: dict[str, Any],
    client: str,
    session: AsyncClientSession,
    source: str | None = None,
) -> None:
    mine = my_participant(account, user_id)
    metadata: dict[str, Any] = {
        "client": client,
        "actorParticipantId": mine["id"] if mine else None,
    }
    if source is not None:
        metadata["source"] = source
    await audit_service.record(
        action,
        actor_user_id=user_id,
        entity_id=settlement_id,
        changes=changes,
        metadata=metadata,
        session=session,
        entity_type="settlement",
        account_id=account["_id"],
    )


# --- Create ---------------------------------------------------------------------------------------


async def create_settlement(
    account_id: str, user_id: ObjectId, request: SettlementCreate, client: str
) -> SettlementResponse:
    account = await require_member(account_id, user_id)
    require_open(account)
    client_request_id = str(request.client_request_id)
    existing = await settlements.find_by_client_request(account["_id"], client_request_id)
    if existing is not None:
        return to_settlement_response(existing, account)
    amount_minor = _amount_minor(request, account)
    _require_active_sides(request, account)

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        sides = [request.from_participant_id, request.to_participant_id]
        if not await accounts.guard_money_write(account["_id"], sides, session):
            return None
        doc = settlements.new_settlement_document(
            account=account,
            from_participant_id=request.from_participant_id,
            to_participant_id=request.to_participant_id,
            amount_minor=amount_minor,
            settlement_date=request.date,
            created_by=user_id,
            client_request_id=client_request_id,
        )
        doc["_id"] = await settlements.insert(doc, session=session)
        await _audit(
            "settlement.created",
            user_id=user_id,
            account=account,
            settlement_id=doc["_id"],
            changes={field: {"after": doc[field]} for field in AUDITED_FIELDS},
            client=client,
            session=session,
            source=request.source,
        )
        return doc

    try:
        doc = await run_in_transaction(write)
    except DuplicateKeyError:
        # A concurrent retry with the same clientRequestId won.
        doc = await settlements.find_by_client_request(account["_id"], client_request_id)
        if doc is None:
            raise
    current = await require_member(account["_id"], user_id)
    if doc is None:
        # The guard did not match: closed, gone or a side was removed meanwhile.
        require_open(current)
        _require_active_sides(request, current)
        raise AppError(422, errors.INVALID_PARTICIPANT)
    return to_settlement_response(doc, current)


# --- List -----------------------------------------------------------------------------------------


async def list_settlements(
    account_id: str, user_id: ObjectId, limit: int, cursor: str | None
) -> SettlementPage:
    account = await require_member(account_id, user_id)
    after = decode_cursor(cursor) if cursor else None
    docs = await settlements.page(account["_id"], limit + 1, after)
    has_more = len(docs) > limit
    docs = docs[:limit]
    return SettlementPage(
        items=[to_settlement_response(doc, account) for doc in docs],
        next_cursor=encode_cursor(docs[-1]) if has_more and docs else None,
    )


# --- Delete ---------------------------------------------------------------------------------------


async def delete_settlement(
    account_id: str, settlement_id: str, user_id: ObjectId, client: str
) -> None:
    account = await require_member(account_id, user_id)
    require_open(account)
    target = await settlements.find_active(account["_id"], settlement_id)
    if target is None:
        raise AppError(404, errors.NOT_FOUND)

    async def write(session: AsyncClientSession) -> str:
        if not await accounts.guard_money_write(account["_id"], [], session):
            return "guard"
        if not await settlements.soft_delete(account["_id"], target["_id"], user_id, session):
            return "gone"
        await _audit(
            "settlement.deleted",
            user_id=user_id,
            account=account,
            settlement_id=target["_id"],
            changes={"isDeleted": {"before": False, "after": True}},
            client=client,
            session=session,
        )
        return "ok"

    outcome = await run_in_transaction(write)
    if outcome == "guard":
        require_open(await require_member(account["_id"], user_id))
    if outcome != "ok":
        raise AppError(404, errors.NOT_FOUND)
