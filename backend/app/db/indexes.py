"""Index definitions from data-model.md, created on application start-up."""

from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo.asynchronous.database import AsyncDatabase

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("email", ASCENDING)], unique=True, name="email_unique"),
        IndexModel(
            [("googleSubject", ASCENDING)],
            unique=True,
            partialFilterExpression={"googleSubject": {"$type": "string"}},
            name="google_subject_unique",
        ),
    ],
    "pending_registrations": [
        IndexModel([("email", ASCENDING)], unique=True, name="email_unique"),
        IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0, name="expires_ttl"),
    ],
    "verification_codes": [
        IndexModel(
            [("email", ASCENDING), ("purpose", ASCENDING), ("createdAt", DESCENDING)],
            name="email_purpose_created",
        ),
        IndexModel([("createdAt", ASCENDING)], expireAfterSeconds=3600, name="created_ttl"),
    ],
    "auth_attempts": [
        IndexModel(
            [
                ("emailHash", ASCENDING),
                ("type", ASCENDING),
                ("purpose", ASCENDING),
                ("createdAt", DESCENDING),
            ],
            name="email_type_purpose_created",
        ),
        IndexModel([("createdAt", ASCENDING)], expireAfterSeconds=3600, name="created_ttl"),
    ],
    "refresh_tokens": [
        IndexModel([("tokenHash", ASCENDING)], unique=True, name="token_hash_unique"),
        IndexModel([("userId", ASCENDING)], name="user_id"),
        IndexModel([("familyId", ASCENDING)], name="family_id"),
        IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0, name="expires_ttl"),
    ],
    "audit_logs": [
        IndexModel(
            [("entityType", ASCENDING), ("entityId", ASCENDING), ("createdAt", DESCENDING)],
            name="entity_created",
        ),
        IndexModel([("actorUserId", ASCENDING), ("createdAt", DESCENDING)], name="actor_created"),
    ],
}


async def ensure_indexes(db: AsyncDatabase) -> None:
    for collection, indexes in INDEXES.items():
        await db[collection].create_indexes(indexes)
