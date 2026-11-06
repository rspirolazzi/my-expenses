from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core.security import normalize_email
from app.db.client import get_database
from app.schemas.user import Preferences, UserResponse

COLLECTION = "users"


def _collection():
    return get_database()[COLLECTION]


def to_object_id(value: str | ObjectId) -> ObjectId | None:
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


async def find_by_id(
    user_id: str | ObjectId, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    oid = to_object_id(user_id)
    if oid is None:
        return None
    return await _collection().find_one({"_id": oid}, session=session)


async def find_by_email(
    email: str, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    return await _collection().find_one({"email": normalize_email(email)}, session=session)


async def find_by_google_subject(
    subject: str, session: AsyncClientSession | None = None
) -> dict[str, Any] | None:
    return await _collection().find_one({"googleSubject": subject}, session=session)


def new_user_document(
    *,
    email: str,
    first_name: str | None,
    last_name: str | None,
    auth_providers: list[str],
    password_hash: str | None = None,
    google_subject: str | None = None,
    language: str = "es",
) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "email": normalize_email(email),
        "firstName": first_name,
        "lastName": last_name,
        "authProviders": auth_providers,
        "googleSubject": google_subject,
        "passwordHash": password_hash,
        "pendingEmail": None,
        "preferences": {"language": language, "defaultCurrency": None, "theme": "system"},
        "createdAt": now,
        "updatedAt": now,
    }


async def insert(document: dict[str, Any], session: AsyncClientSession | None = None) -> ObjectId:
    result = await _collection().insert_one(document, session=session)
    return result.inserted_id


async def update_fields(
    user_id: ObjectId,
    fields: dict[str, Any],
    session: AsyncClientSession | None = None,
    add_to_set: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    update: dict[str, Any] = {"$set": {**fields, "updatedAt": datetime.now(UTC)}}
    if add_to_set:
        update["$addToSet"] = add_to_set
    return await _collection().find_one_and_update(
        {"_id": user_id}, update, session=session, return_document=True
    )


def to_user_response(doc: dict[str, Any]) -> UserResponse:
    """Public view of a user: never exposes passwordHash or googleSubject."""
    prefs = doc.get("preferences") or {}
    return UserResponse(
        id=str(doc["_id"]),
        email=doc["email"],
        first_name=doc.get("firstName"),
        last_name=doc.get("lastName"),
        auth_providers=list(doc.get("authProviders", [])),
        has_password_set=doc.get("passwordHash") is not None,
        pending_email=doc.get("pendingEmail"),
        preferences=Preferences(
            language=prefs.get("language", "es"),
            default_currency=prefs.get("defaultCurrency"),
            theme=prefs.get("theme", "system"),
        ),
        created_at=doc["createdAt"],
        updated_at=doc["updatedAt"],
    )
