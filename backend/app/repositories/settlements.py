"""Access to the `settlements` collection (data-model.md). Amounts are integer minor units."""

from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core.cursor import keyset_after
from app.db.client import get_database
from app.repositories.expenses import LIST_SORT
from app.repositories.users import to_object_id

COLLECTION = "settlements"


def _collection():
    return get_database()[COLLECTION]


def new_settlement_document(
    *,
    account: dict[str, Any],
    from_participant_id: str,
    to_participant_id: str,
    amount_minor: int,
    settlement_date: date,
    created_by: ObjectId,
    client_request_id: str | None,
) -> dict[str, Any]:
    return {
        "accountId": account["_id"],
        "fromParticipantId": from_participant_id,
        "toParticipantId": to_participant_id,
        "amountMinor": amount_minor,
        "currency": account["currency"],
        "date": settlement_date.isoformat(),
        "clientRequestId": client_request_id,
        "isDeleted": False,
        "deletedAt": None,
        "deletedBy": None,
        "createdBy": created_by,
        "createdAt": datetime.now(UTC),
    }


async def insert(document: dict[str, Any], session: AsyncClientSession | None = None) -> ObjectId:
    result = await _collection().insert_one(document, session=session)
    return result.inserted_id


async def find_active(
    account_id: ObjectId, settlement_id: str | ObjectId, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    oid = to_object_id(settlement_id)
    if oid is None:
        return None
    return await _collection().find_one(
        {"_id": oid, "accountId": account_id, "isDeleted": False}, session=session
    )


async def find_by_client_request(
    account_id: ObjectId, client_request_id: str
) -> dict[str, Any] | None:
    return await _collection().find_one(
        {"accountId": account_id, "clientRequestId": client_request_id}
    )


async def page(
    account_id: ObjectId, limit: int, after: tuple[str, datetime, ObjectId] | None = None
) -> list[dict[str, Any]]:
    """Keyset page of the active settlements: date desc, createdAt desc, _id desc."""
    query: dict[str, Any] = {"accountId": account_id, "isDeleted": False}
    if after is not None:
        query.update(keyset_after(after))
    cursor = _collection().find(query).sort(LIST_SORT).limit(limit)
    return [doc async for doc in cursor]


async def soft_delete(
    account_id: ObjectId,
    settlement_id: ObjectId,
    user_id: ObjectId,
    session: AsyncClientSession | None = None,
) -> bool:
    """Logical delete; False if it was already deleted (or never existed)."""
    result = await _collection().update_one(
        {"_id": settlement_id, "accountId": account_id, "isDeleted": False},
        {"$set": {"isDeleted": True, "deletedAt": datetime.now(UTC), "deletedBy": user_id}},
        session=session,
    )
    return result.modified_count == 1


async def active_for_accounts(account_ids: list[ObjectId]) -> list[dict[str, Any]]:
    """Active settlements of the given accounts, projected to what the balances need (R1)."""
    cursor = _collection().find(
        {"accountId": {"$in": account_ids}, "isDeleted": False},
        {"accountId": 1, "fromParticipantId": 1, "toParticipantId": 1, "amountMinor": 1},
    )
    return [doc async for doc in cursor]
