"""Insert and read access to `audit_logs` (Principle IV): no update or delete operations exist."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import DESCENDING
from pymongo.asynchronous.client_session import AsyncClientSession

from app.db.client import get_database

COLLECTION = "audit_logs"


async def insert(
    *,
    action: str,
    actor_user_id: ObjectId | None,
    entity_id: ObjectId | None,
    changes: dict[str, Any],
    metadata: dict[str, Any],
    entity_type: str = "user",
    account_id: ObjectId | None = None,
    session: AsyncClientSession | None = None,
) -> None:
    document: dict[str, Any] = {
        "actorUserId": actor_user_id,
        "action": action,
        "entityType": entity_type,
        "entityId": entity_id,
        "changes": changes,
        "metadata": metadata,
        "createdAt": datetime.now(UTC),
    }
    # Only new entries carry accountId; older account.* entries keep it in entityId (research R8).
    if account_id is not None:
        document["accountId"] = account_id
    await get_database()[COLLECTION].insert_one(document, session=session)


async def list_for_entity(entity_type: str, entity_id: ObjectId) -> list[dict[str, Any]]:
    """Entries of one entity, most recent first (read-only)."""
    cursor = (
        get_database()[COLLECTION]
        .find({"entityType": entity_type, "entityId": entity_id})
        .sort([("createdAt", DESCENDING), ("_id", DESCENDING)])
    )
    return [doc async for doc in cursor]
