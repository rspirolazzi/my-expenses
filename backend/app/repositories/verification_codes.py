from datetime import UTC, datetime
from typing import Any, Literal

from bson import ObjectId
from pymongo import DESCENDING
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core.security import normalize_email
from app.db.client import get_database

COLLECTION = "verification_codes"
MAX_ATTEMPTS = 5

CodePurpose = Literal["verify_email", "login", "password_reset", "change_email"]


def _collection():
    return get_database()[COLLECTION]


async def insert(
    *,
    email: str,
    purpose: CodePurpose,
    code_hash: str,
    expires_at: datetime,
    user_id: ObjectId | None,
) -> ObjectId:
    result = await _collection().insert_one(
        {
            "email": normalize_email(email),
            "userId": user_id,
            "purpose": purpose,
            "codeHash": code_hash,
            "attempts": 0,
            "consumedAt": None,
            "invalidatedAt": None,
            "expiresAt": expires_at,
            "createdAt": datetime.now(UTC),
        }
    )
    return result.inserted_id


async def find_latest_valid(email: str, purpose: CodePurpose) -> dict[str, Any] | None:
    """Valid only if consumedAt and invalidatedAt are null, expiresAt > now and attempts < 5."""
    return await _collection().find_one(
        {
            "email": normalize_email(email),
            "purpose": purpose,
            "consumedAt": None,
            "invalidatedAt": None,
            "expiresAt": {"$gt": datetime.now(UTC)},
            "attempts": {"$lt": MAX_ATTEMPTS},
        },
        sort=[("createdAt", DESCENDING)],
    )


async def invalidate_active(email: str, purpose: CodePurpose) -> None:
    await _collection().update_many(
        {
            "email": normalize_email(email),
            "purpose": purpose,
            "consumedAt": None,
            "invalidatedAt": None,
        },
        {"$set": {"invalidatedAt": datetime.now(UTC)}},
    )


async def increment_attempts(code_id: ObjectId) -> int:
    doc = await _collection().find_one_and_update(
        {"_id": code_id}, {"$inc": {"attempts": 1}}, return_document=True
    )
    return doc["attempts"] if doc else MAX_ATTEMPTS


async def mark_consumed(code_id: ObjectId, session: AsyncClientSession | None = None) -> bool:
    """Atomically consume the code; returns False if it was already consumed or invalidated."""
    result = await _collection().update_one(
        {"_id": code_id, "consumedAt": None, "invalidatedAt": None},
        {"$set": {"consumedAt": datetime.now(UTC)}},
        session=session,
    )
    return result.modified_count == 1


async def mark_invalidated(code_id: ObjectId) -> None:
    await _collection().update_one({"_id": code_id}, {"$set": {"invalidatedAt": datetime.now(UTC)}})
