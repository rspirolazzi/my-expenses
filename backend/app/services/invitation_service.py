"""Invitation preview and acceptance (research R4, R5)."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core import errors
from app.core.errors import AppError
from app.db.client import run_in_transaction
from app.repositories import accounts
from app.schemas.account import (
    MAX_PARTICIPANTS,
    AcceptInvitation,
    AccountResponse,
    AvailableParticipant,
    InvitationPreview,
    name_key,
)
from app.services import audit_service
from app.services.account_permissions import (
    active_participants,
    is_member,
    to_account_response,
)


async def _valid_account(code: str) -> dict[str, Any]:
    """Unknown, regenerated, closed and deleted invitations all look the same."""
    doc = await accounts.find_by_invite_code(code)
    if doc is None or doc.get("isDeleted") or doc.get("isClosed"):
        raise AppError(404, errors.INVALID_INVITATION)
    return doc


async def preview(code: str, user_id: ObjectId) -> InvitationPreview:
    doc = await _valid_account(code)
    member = is_member(doc, user_id)
    return InvitationPreview(
        account_name=doc["name"],
        icon=doc["icon"],
        currency=doc["currency"],
        already_member=member,
        account_id=str(doc["_id"]) if member else None,
        available_participants=[
            AvailableParticipant(id=p["id"], name=p["name"])
            for p in active_participants(doc)
            if p.get("userId") is None
        ],
    )


async def accept(
    code: str, user_id: ObjectId, request: AcceptInvitation, client: str
) -> AccountResponse:
    doc = await _valid_account(code)
    if is_member(doc, user_id):
        raise AppError(409, errors.ALREADY_MEMBER)

    # Conditions checked atomically by the update (research R5).
    base_filter: dict[str, Any] = {
        "inviteCode": code,
        "isClosed": False,
        "isDeleted": False,
        "participants.userId": {"$ne": user_id},
    }
    now = datetime.now(UTC)
    if request.participant_id is not None:
        participant_id = request.participant_id
        update = {"$set": {"participants.$[p].userId": user_id, "participants.$[p].linkedAt": now}}
        extra = {
            **base_filter,
            "participants": {
                "$elemMatch": {"id": participant_id, "userId": None, "removedAt": None}
            },
        }
        array_filters = [{"p.id": participant_id}]
        created = False
    else:
        name = request.new_participant_name or ""
        key = name_key(name)
        active = active_participants(doc)
        if any(p["nameKey"] == key for p in active):
            raise AppError(422, errors.DUPLICATE_PARTICIPANT_NAME)
        if len(active) >= MAX_PARTICIPANTS:
            raise AppError(422, errors.VALIDATION_ERROR)
        participant = accounts.new_participant(name, user_id)
        participant_id = participant["id"]
        update = {"$push": {"participants": participant}}
        extra = {
            **base_filter,
            "participants": {"$not": {"$elemMatch": {"nameKey": key, "removedAt": None}}},
        }
        array_filters = None
        created = True

    async def write(session: AsyncClientSession) -> dict[str, Any] | None:
        updated = await accounts.update(
            doc["_id"], update, session=session, extra_filter=extra, array_filters=array_filters
        )
        if updated is not None:
            changes: dict[str, Any] = {
                f"participant.{participant_id}.userId": {"before": None, "after": user_id}
            }
            if created:
                changes["participant"] = {"after": {"id": participant_id, "name": name}}
            await audit_service.record(
                "account.member_joined",
                actor_user_id=user_id,
                entity_id=doc["_id"],
                changes=changes,
                metadata={"client": client},
                session=session,
                entity_type="account",
            )
        return updated

    updated = await run_in_transaction(write)
    if updated is None:
        current = await _valid_account(code)
        if is_member(current, user_id):
            raise AppError(409, errors.ALREADY_MEMBER)
        if created:
            raise AppError(422, errors.DUPLICATE_PARTICIPANT_NAME)
        raise AppError(409, errors.PARTICIPANT_TAKEN)
    return to_account_response(updated, user_id)
