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
    "accounts": [
        IndexModel([("inviteCode", ASCENDING)], unique=True, name="invite_code_unique"),
        IndexModel(
            [
                ("participants.userId", ASCENDING),
                ("isDeleted", ASCENDING),
                ("updatedAt", DESCENDING),
            ],
            name="member_accounts",
        ),
    ],
    "expenses": [
        IndexModel(
            [
                ("accountId", ASCENDING),
                ("isDeleted", ASCENDING),
                ("date", DESCENDING),
                ("createdAt", DESCENDING),
                ("_id", DESCENDING),
            ],
            name="account_list",
        ),
        IndexModel([("accountId", ASCENDING), ("paidById", ASCENDING)], name="account_payer"),
        IndexModel(
            [("accountId", ASCENDING), ("participantIds", ASCENDING)],
            name="account_participants",
        ),
        IndexModel(
            [("accountId", ASCENDING), ("clientRequestId", ASCENDING)],
            unique=True,
            partialFilterExpression={"clientRequestId": {"$type": "string"}},
            name="client_request_unique",
        ),
    ],
    "settlements": [
        IndexModel(
            [
                ("accountId", ASCENDING),
                ("isDeleted", ASCENDING),
                ("date", DESCENDING),
                ("createdAt", DESCENDING),
                ("_id", DESCENDING),
            ],
            name="account_list",
        ),
        IndexModel(
            [("accountId", ASCENDING), ("clientRequestId", ASCENDING)],
            unique=True,
            partialFilterExpression={"clientRequestId": {"$type": "string"}},
            name="client_request_unique",
        ),
    ],
    "audit_logs": [
        IndexModel(
            [("entityType", ASCENDING), ("entityId", ASCENDING), ("createdAt", DESCENDING)],
            name="entity_created",
        ),
        IndexModel([("actorUserId", ASCENDING), ("createdAt", DESCENDING)], name="actor_created"),
        IndexModel([("accountId", ASCENDING), ("createdAt", DESCENDING)], name="account_created"),
    ],
}


async def ensure_indexes(db: AsyncDatabase) -> None:
    for collection, indexes in INDEXES.items():
        await db[collection].create_indexes(indexes)
