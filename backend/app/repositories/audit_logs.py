"""Insert-only access to `audit_logs` (Principle IV): no update or delete operations exist here."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
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
    session: AsyncClientSession | None = None,
) -> None:
    await get_database()[COLLECTION].insert_one(
        {
            "actorUserId": actor_user_id,
            "action": action,
            "entityType": entity_type,
            "entityId": entity_id,
            "changes": changes,
            "metadata": metadata,
            "createdAt": datetime.now(UTC),
        },
        session=session,
    )
