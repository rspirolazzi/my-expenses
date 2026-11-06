from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.db.client import get_database

COLLECTION = "refresh_tokens"


def _collection():
    return get_database()[COLLECTION]


async def insert(
    *,
    user_id: ObjectId,
    family_id: str,
    token_hash: str,
    client: str,
    expires_at: datetime,
    session: AsyncClientSession | None = None,
) -> None:
    await _collection().insert_one(
        {
            "userId": user_id,
            "familyId": family_id,
            "tokenHash": token_hash,
            "client": client,
            "createdAt": datetime.now(UTC),
            "expiresAt": expires_at,
            "rotatedAt": None,
            "revokedAt": None,
        },
        session=session,
    )


async def find_by_hash(token_hash: str) -> dict[str, Any] | None:
    return await _collection().find_one({"tokenHash": token_hash})


async def mark_rotated(token_id: ObjectId, session: AsyncClientSession | None = None) -> bool:
    """Atomically mark an active token as rotated; False if another request rotated it first."""
    result = await _collection().update_one(
        {"_id": token_id, "rotatedAt": None, "revokedAt": None},
        {"$set": {"rotatedAt": datetime.now(UTC)}},
        session=session,
    )
    return result.modified_count == 1


async def revoke_family(family_id: str, session: AsyncClientSession | None = None) -> None:
    await _collection().update_many(
        {"familyId": family_id, "revokedAt": None},
        {"$set": {"revokedAt": datetime.now(UTC)}},
        session=session,
    )


async def revoke_all_for_user(
    user_id: ObjectId,
    except_family_id: str | None = None,
    session: AsyncClientSession | None = None,
) -> None:
    query: dict[str, Any] = {"userId": user_id, "revokedAt": None}
    if except_family_id is not None:
        query["familyId"] = {"$ne": except_family_id}
    await _collection().update_many(
        query, {"$set": {"revokedAt": datetime.now(UTC)}}, session=session
    )


async def revoke_by_hash(token_hash: str) -> dict[str, Any] | None:
    return await _collection().find_one_and_update(
        {"tokenHash": token_hash, "revokedAt": None},
        {"$set": {"revokedAt": datetime.now(UTC)}},
    )
