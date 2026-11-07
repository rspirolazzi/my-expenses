"""Access to the `accounts` collection (participants are embedded, research R1)."""

import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import DESCENDING, ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession

from app.db.client import get_database
from app.repositories.users import to_object_id
from app.schemas.account import name_key

COLLECTION = "accounts"


def _collection():
    return get_database()[COLLECTION]


def new_invite_code() -> str:
    """128 random bits, 22 base64url characters (research R4)."""
    return secrets.token_urlsafe(16)


def new_participant(name: str, user_id: ObjectId | None = None) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "id": str(uuid.uuid4()),
        "name": name.strip(),
        "nameKey": name_key(name),
        "userId": user_id,
        "joinedAt": now,
        "linkedAt": now if user_id is not None else None,
        "removedAt": None,
    }


def new_account_document(
    *,
    name: str,
    description: str | None,
    icon: str,
    currency: str,
    owner_id: ObjectId,
    participants: list[dict[str, Any]],
) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "name": name,
        "description": description,
        "icon": icon,
        "currency": currency,
        "ownerId": owner_id,
        "participants": participants,
        "inviteCode": new_invite_code(),
        "isClosed": False,
        "closedAt": None,
        "isDeleted": False,
        "deletedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }


async def insert(document: dict[str, Any], session: AsyncClientSession | None = None) -> ObjectId:
    result = await _collection().insert_one(document, session=session)
    return result.inserted_id


async def find_by_id(
    account_id: str | ObjectId, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    oid = to_object_id(account_id)
    if oid is None:
        return None
    return await _collection().find_one({"_id": oid}, session=session)


async def find_by_invite_code(code: str) -> dict[str, Any] | None:
    return await _collection().find_one({"inviteCode": code})


def _member_filter(user_id: ObjectId) -> dict[str, Any]:
    return {
        "isDeleted": False,
        "participants": {"$elemMatch": {"userId": user_id, "removedAt": None}},
    }


async def find_for_member(
    account_id: str | ObjectId, user_id: ObjectId, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    oid = to_object_id(account_id)
    if oid is None:
        return None
    return await _collection().find_one({"_id": oid, **_member_filter(user_id)}, session=session)


async def list_for_member(user_id: ObjectId) -> list[dict[str, Any]]:
    cursor = _collection().find(_member_filter(user_id)).sort("updatedAt", DESCENDING)
    return [doc async for doc in cursor]


async def update(
    account_id: ObjectId,
    update_doc: dict[str, Any],
    session: AsyncClientSession | None = None,
    extra_filter: dict[str, Any] | None = None,
    array_filters: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """Conditional update; returns the updated document, or None if the filter did not match."""
    update_doc = {**update_doc}
    update_doc.setdefault("$set", {})
    update_doc["$set"] = {**update_doc["$set"], "updatedAt": datetime.now(UTC)}
    return await _collection().find_one_and_update(
        {"_id": account_id, **(extra_filter or {})},
        update_doc,
        session=session,
        array_filters=array_filters,
        return_document=ReturnDocument.AFTER,
    )
