from datetime import UTC, datetime, timedelta
from typing import Any

from pymongo.asynchronous.client_session import AsyncClientSession

from app.core.security import normalize_email
from app.db.client import get_database

COLLECTION = "pending_registrations"
PENDING_REGISTRATION_TTL = timedelta(hours=24)


def _collection():
    return get_database()[COLLECTION]


async def upsert_by_email(
    *,
    email: str,
    password_hash: str,
    first_name: str | None,
    last_name: str | None,
    language: str,
) -> None:
    """A new registration replaces any previous pending one for the same email."""
    now = datetime.now(UTC)
    await _collection().replace_one(
        {"email": normalize_email(email)},
        {
            "email": normalize_email(email),
            "passwordHash": password_hash,
            "firstName": first_name,
            "lastName": last_name,
            "language": language,
            "createdAt": now,
            "expiresAt": now + PENDING_REGISTRATION_TTL,
        },
        upsert=True,
    )


async def find_by_email(
    email: str, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    doc = await _collection().find_one({"email": normalize_email(email)}, session=session)
    # The TTL monitor runs about once a minute, so expired documents may still be present.
    if doc and doc["expiresAt"] <= datetime.now(UTC):
        return None
    return doc


async def delete_by_email(email: str, session: AsyncClientSession | None = None) -> None:
    await _collection().delete_one({"email": normalize_email(email)}, session=session)
