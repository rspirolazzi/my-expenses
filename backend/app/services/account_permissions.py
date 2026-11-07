"""Membership, Owner and open-account checks, and public views of an account (research R6)."""

from typing import Any

from bson import ObjectId

from app.core import errors
from app.core.errors import AppError
from app.repositories import accounts
from app.schemas.account import AccountResponse, AccountSummary, ParticipantResponse


def active_participants(doc: dict[str, Any]) -> list[dict[str, Any]]:
    return [p for p in doc.get("participants", []) if p.get("removedAt") is None]


def my_participant(doc: dict[str, Any], user_id: ObjectId) -> dict[str, Any] | None:
    return next((p for p in active_participants(doc) if p.get("userId") == user_id), None)


def owner_participant(doc: dict[str, Any]) -> dict[str, Any] | None:
    return my_participant(doc, doc["ownerId"])


def is_owner(doc: dict[str, Any], user_id: ObjectId) -> bool:
    return doc["ownerId"] == user_id


def is_member(doc: dict[str, Any], user_id: ObjectId) -> bool:
    return not doc.get("isDeleted") and my_participant(doc, user_id) is not None


async def require_member(account_id: str | ObjectId, user_id: ObjectId) -> dict[str, Any]:
    """The account, if the user is a member; otherwise 404, exactly like a missing account."""
    doc = await accounts.find_for_member(account_id, user_id)
    if doc is None:
        raise AppError(404, errors.NOT_FOUND)
    return doc


def require_owner(doc: dict[str, Any], user_id: ObjectId) -> None:
    if not is_owner(doc, user_id):
        raise AppError(403, errors.OWNER_ONLY)


def require_open(doc: dict[str, Any]) -> None:
    if doc.get("isClosed"):
        raise AppError(409, errors.ACCOUNT_CLOSED)


def to_account_response(doc: dict[str, Any], user_id: ObjectId) -> AccountResponse:
    """Public view for a member: active participants only, never the linked user ids."""
    mine = my_participant(doc, user_id)
    return AccountResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description"),
        icon=doc["icon"],
        currency=doc["currency"],
        is_closed=bool(doc.get("isClosed")),
        closed_at=doc.get("closedAt"),
        is_owner=is_owner(doc, user_id),
        my_participant_id=mine["id"] if mine else "",
        participants=[
            ParticipantResponse(
                id=p["id"],
                name=p["name"],
                is_linked=p.get("userId") is not None,
                is_me=p.get("userId") == user_id,
                is_owner=p.get("userId") == doc["ownerId"],
            )
            for p in active_participants(doc)
        ],
        invite_code=doc["inviteCode"],
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
    )


def to_account_summary(doc: dict[str, Any], user_id: ObjectId) -> AccountSummary:
    return AccountSummary(
        id=str(doc["_id"]),
        name=doc["name"],
        icon=doc["icon"],
        currency=doc["currency"],
        is_closed=bool(doc.get("isClosed")),
        is_owner=is_owner(doc, user_id),
        participant_count=len(active_participants(doc)),
        updated_at=doc["updatedAt"],
    )
