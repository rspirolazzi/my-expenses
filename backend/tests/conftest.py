import os

# Tests always use the in-memory email outbox and the separate test database.
os.environ["ENVIRONMENT"] = "test"
os.environ["EMAIL_DELIVERY"] = "console"

from collections.abc import AsyncIterator  # noqa: E402
from datetime import UTC, datetime  # noqa: E402
from typing import Any  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from bson import ObjectId  # noqa: E402

from app.core import errors  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.core.security import create_access_token, hash_password, normalize_email  # noqa: E402
from app.db import client as mongo  # noqa: E402
from app.db.indexes import INDEXES, ensure_indexes  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email_service  # noqa: E402
from app.services.email_service import SentEmail  # noqa: E402
from app.services.google_service import GoogleClaims, get_google_verifier  # noqa: E402

COLLECTIONS = list(INDEXES)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _mongo() -> AsyncIterator[None]:
    await mongo.connect()
    db = mongo.get_database()
    assert db.name.endswith("_test"), "tests must never run against the main database"
    await mongo.get_client().drop_database(db.name)
    await ensure_indexes(db)
    yield
    await mongo.close()


@pytest_asyncio.fixture(autouse=True)
async def _clean_collections() -> None:
    db = mongo.get_database()
    for name in COLLECTIONS:
        await db[name].delete_many({})


@pytest.fixture
def db():
    return mongo.get_database()


@pytest.fixture(autouse=True)
def email_outbox() -> list[SentEmail]:
    outbox: list[SentEmail] = []
    email_service.capture = outbox
    yield outbox
    email_service.capture = None


def last_code(outbox: list[SentEmail], to: str) -> str:
    for email in reversed(outbox):
        if email.to == normalize_email(to) and "code" in email.context:
            return email.context["code"]
    raise AssertionError(f"no code email sent to {to}")


@pytest.fixture
def failing_email(monkeypatch):
    """Make every email delivery fail with the provider error (503)."""

    async def _fail(*_args, **_kwargs):
        raise AppError(503, errors.EMAIL_UNAVAILABLE)

    monkeypatch.setattr(email_service, "send", _fail)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as http:
        yield http


class FakeGoogleVerifier:
    """Maps fake ID tokens to claims; unknown tokens are rejected like an invalid signature."""

    def __init__(self) -> None:
        self.tokens: dict[str, GoogleClaims] = {}

    def add(self, token: str, **claims: Any) -> str:
        self.tokens[token] = GoogleClaims(**claims)
        return token

    def __call__(self, token: str) -> GoogleClaims:
        if token not in self.tokens:
            raise AppError(401, errors.INVALID_GOOGLE_TOKEN)
        return self.tokens[token]


@pytest.fixture
def fake_google_verifier():
    verifier = FakeGoogleVerifier()
    app.dependency_overrides[get_google_verifier] = lambda: verifier
    yield verifier
    app.dependency_overrides.pop(get_google_verifier, None)


@pytest.fixture
def create_user(db):
    async def _create(
        email: str = "ana@mail.com",
        password: str | None = "correct-password",
        google_subject: str | None = None,
        language: str = "es",
        default_currency: str | None = "ARS",
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        providers = []
        if google_subject:
            providers.append("google")
        if password:
            providers.append("email")
        doc = {
            "email": normalize_email(email),
            "firstName": first_name,
            "lastName": last_name,
            "authProviders": providers,
            "googleSubject": google_subject,
            "passwordHash": hash_password(password) if password else None,
            "pendingEmail": None,
            "preferences": {
                "language": language,
                "defaultCurrency": default_currency,
                "theme": "system",
            },
            "createdAt": now,
            "updatedAt": now,
        }
        doc["_id"] = (await db.users.insert_one(doc)).inserted_id
        return doc

    return _create


def auth_headers(user_id: ObjectId | str) -> dict[str, str]:
    token, _ = create_access_token(str(user_id))
    return {"Authorization": f"Bearer {token}"}


async def actions(db, entity_id: ObjectId | None = None) -> list[str]:
    query = {} if entity_id is None else {"entityId": entity_id}
    return [doc["action"] async for doc in db.audit_logs.find(query).sort("createdAt", 1)]


@pytest.fixture
def create_account(db):
    """Insert an account whose owner participant is linked to `owner`."""
    from app.repositories import accounts as accounts_repo

    async def _create(
        owner: dict[str, Any],
        name: str = "Viaje",
        currency: str = "ARS",
        others: tuple[str, ...] = ("Leandro", "Javier"),
        closed: bool = False,
        deleted: bool = False,
        owner_name: str = "Ana",
    ) -> dict[str, Any]:
        participants = [accounts_repo.new_participant(owner_name, owner["_id"])]
        participants += [accounts_repo.new_participant(other) for other in others]
        doc = accounts_repo.new_account_document(
            name=name,
            description=None,
            icon="group",
            currency=currency,
            owner_id=owner["_id"],
            participants=participants,
        )
        doc["isClosed"] = closed
        doc["isDeleted"] = deleted
        doc["_id"] = await accounts_repo.insert(doc)
        return doc

    return _create


async def link(db, account: dict[str, Any], participant_name: str, user: dict[str, Any]) -> str:
    """Link `user` to the participant called `participant_name`; returns the participant id."""
    doc = await db.accounts.find_one({"_id": account["_id"]})
    participant = next(p for p in doc["participants"] if p["name"] == participant_name)
    await db.accounts.update_one(
        {"_id": account["_id"], "participants.id": participant["id"]},
        {"$set": {"participants.$.userId": user["_id"]}},
    )
    return participant["id"]


def participant_id(account: dict[str, Any], name: str) -> str:
    return next(p["id"] for p in account["participants"] if p["name"] == name)
