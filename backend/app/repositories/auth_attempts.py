"""Per-email request and failure records, keyed by an HMAC of the email (never the email itself)."""

from datetime import UTC, datetime
from typing import Any, Literal

from bson import ObjectId
from pymongo import DESCENDING

from app.db.client import get_database

COLLECTION = "auth_attempts"

AttemptType = Literal["email_request", "password_failure", "password_lockout"]
LimitPurpose = Literal["register", "login", "password_reset", "change_email"]


def _collection():
    return get_database()[COLLECTION]


async def insert(
    email_hash: str, type: AttemptType, purpose: LimitPurpose | None = None
) -> ObjectId:
    result = await _collection().insert_one(
        {
            "emailHash": email_hash,
            "type": type,
            "purpose": purpose,
            "createdAt": datetime.now(UTC),
        }
    )
    return result.inserted_id


async def count_since(
    email_hash: str, type: AttemptType, purpose: LimitPurpose | None, since: datetime
) -> int:
    return await _collection().count_documents(
        {
            "emailHash": email_hash,
            "type": type,
            "purpose": purpose,
            "createdAt": {"$gt": since},
        }
    )


async def oldest_since(
    email_hash: str, type: AttemptType, purpose: LimitPurpose | None, since: datetime
) -> dict[str, Any] | None:
    return await _collection().find_one(
        {"emailHash": email_hash, "type": type, "purpose": purpose, "createdAt": {"$gt": since}},
        sort=[("createdAt", 1)],
    )


async def latest(email_hash: str, type: AttemptType, since: datetime) -> dict[str, Any] | None:
    return await _collection().find_one(
        {"emailHash": email_hash, "type": type, "createdAt": {"$gt": since}},
        sort=[("createdAt", DESCENDING)],
    )


async def delete_by_id(attempt_id: ObjectId) -> None:
    await _collection().delete_one({"_id": attempt_id})


async def delete_failures(email_hash: str) -> None:
    await _collection().delete_many({"emailHash": email_hash, "type": "password_failure"})
