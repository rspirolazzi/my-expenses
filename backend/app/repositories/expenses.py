"""Access to the `expenses` collection (research R4–R7). Amounts are integer minor units."""

from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId
from pymongo import DESCENDING, ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core.cursor import keyset_after
from app.db.client import get_database
from app.repositories.users import to_object_id

COLLECTION = "expenses"

# Listing order: day desc, then the last loaded first, then _id as a tie-breaker (research R3).
LIST_SORT = [("date", DESCENDING), ("createdAt", DESCENDING), ("_id", DESCENDING)]


def _collection():
    return get_database()[COLLECTION]


def order_participants(participant_ids: list[str], account: dict[str, Any]) -> list[str]:
    """Stored in the account's participant order, so the split never depends on request order."""
    position = {p["id"]: index for index, p in enumerate(account["participants"])}
    return sorted(dict.fromkeys(participant_ids), key=lambda pid: position.get(pid, len(position)))


def new_expense_document(
    *,
    account: dict[str, Any],
    expense_date: date,
    title: str,
    description: str | None,
    amount_minor: int,
    paid_by_id: str,
    participant_ids: list[str],
    category_icon: str,
    created_by: ObjectId,
    client_request_id: str | None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "accountId": account["_id"],
        "date": expense_date.isoformat(),
        "title": title,
        "description": description,
        "amountMinor": amount_minor,
        "currency": account["currency"],
        "paidById": paid_by_id,
        "participantIds": order_participants(participant_ids, account),
        "categoryIcon": category_icon,
        "version": 1,
        "clientRequestId": client_request_id,
        "isDeleted": False,
        "deletedAt": None,
        "createdBy": created_by,
        "createdAt": now,
        "updatedAt": now,
    }


async def insert(document: dict[str, Any], session: AsyncClientSession | None = None) -> ObjectId:
    result = await _collection().insert_one(document, session=session)
    return result.inserted_id


async def find_active(
    account_id: ObjectId, expense_id: str | ObjectId, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    oid = to_object_id(expense_id)
    if oid is None:
        return None
    return await _collection().find_one(
        {"_id": oid, "accountId": account_id, "isDeleted": False}, session=session
    )


async def find_any(account_id: ObjectId, expense_id: str | ObjectId) -> dict[str, Any] | None:
    """Including deleted ones: used to tell a conflict from a deletion."""
    oid = to_object_id(expense_id)
    if oid is None:
        return None
    return await _collection().find_one({"_id": oid, "accountId": account_id})


async def find_by_client_request(
    account_id: ObjectId, client_request_id: str
) -> dict[str, Any] | None:
    return await _collection().find_one(
        {"accountId": account_id, "clientRequestId": client_request_id}
    )


async def page(
    account_id: ObjectId, limit: int, after: tuple[str, datetime, ObjectId] | None = None
) -> list[dict[str, Any]]:
    """Keyset page: the expenses strictly after `after` in LIST_SORT order (research R5)."""
    query: dict[str, Any] = {"accountId": account_id, "isDeleted": False}
    if after is not None:
        query.update(keyset_after(after))
    cursor = _collection().find(query).sort(LIST_SORT).limit(limit)
    return [doc async for doc in cursor]


async def totals(account_id: ObjectId) -> tuple[int, int]:
    """Sum of amountMinor and count of the active expenses (pending ones included)."""
    pipeline = [
        {"$match": {"accountId": account_id, "isDeleted": False}},
        {"$group": {"_id": None, "total": {"$sum": "$amountMinor"}, "count": {"$sum": 1}}},
    ]
    async for row in await _collection().aggregate(pipeline):
        return int(row["total"]), int(row["count"])
    return 0, 0


async def update_versioned(
    account_id: ObjectId,
    expense_id: ObjectId,
    version: int,
    set_fields: dict[str, Any],
    session: AsyncClientSession | None = None,
) -> dict[str, Any] | None:
    """Optimistic update (research R6): only applies to that version of an active expense."""
    return await _collection().find_one_and_update(
        {"_id": expense_id, "accountId": account_id, "isDeleted": False, "version": version},
        {"$set": {**set_fields, "updatedAt": datetime.now(UTC)}, "$inc": {"version": 1}},
        session=session,
        return_document=ReturnDocument.AFTER,
    )


def _affected_filter(account_id: ObjectId, participant_id: str) -> dict[str, Any]:
    return {
        "accountId": account_id,
        "isDeleted": False,
        "$or": [{"paidById": participant_id}, {"participantIds": participant_id}],
    }


async def find_affected_by_participant(
    account_id: ObjectId, participant_id: str, session: AsyncClientSession | None = None
) -> list[dict[str, Any]]:
    cursor = _collection().find(_affected_filter(account_id, participant_id), session=session)
    return [doc async for doc in cursor]


async def count_affected_by_participant(account_id: ObjectId, participant_id: str) -> int:
    return await _collection().count_documents(_affected_filter(account_id, participant_id))


async def apply_participant_removal(
    expense: dict[str, Any], participant_id: str, session: AsyncClientSession
) -> dict[str, Any] | None:
    """Empty the payer and/or drop the participant (research R9); bumps the version."""
    set_fields: dict[str, Any] = {"updatedAt": datetime.now(UTC)}
    if expense.get("paidById") == participant_id:
        set_fields["paidById"] = None
    return await _collection().find_one_and_update(
        {"_id": expense["_id"], "isDeleted": False},
        {
            "$set": set_fields,
            "$pull": {"participantIds": participant_id},
            "$inc": {"version": 1},
        },
        session=session,
        return_document=ReturnDocument.AFTER,
    )


async def active_for_balances(account_ids: list[ObjectId]) -> list[dict[str, Any]]:
    """Active expenses of the given accounts, projected to what the balances need (R1)."""
    cursor = _collection().find(
        {"accountId": {"$in": account_ids}, "isDeleted": False},
        {"accountId": 1, "amountMinor": 1, "paidById": 1, "participantIds": 1},
    )
    return [doc async for doc in cursor]


# Fields an export never needs; internal and user identifiers stay out of the file (research R9).
_EXPORT_EXCLUDED = {"clientRequestId": 0, "createdBy": 0, "deletedBy": 0, "version": 0}


async def active_for_export(
    account_ids: list[ObjectId], session: AsyncClientSession | None = None
) -> list[dict[str, Any]]:
    """Active expenses of the given accounts in the app's listing order (FR-005)."""
    query = {"accountId": {"$in": account_ids}, "isDeleted": False}
    cursor = _collection().find(query, _EXPORT_EXCLUDED, session=session).sort(LIST_SORT)
    return [doc async for doc in cursor]
