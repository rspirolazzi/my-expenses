from tests.conftest import actions, last_code


async def _register(client, email="ana@mail.com", **extra):
    payload = {"email": email, "password": "secret-123", **extra}
    return await client.post("/auth/register", json=payload)


async def test_registration_is_pending_until_verified(client, db, email_outbox):
    await _register(client, firstName="Ana", language="en")
    assert await db.users.count_documents({}) == 0
    assert await db.pending_registrations.count_documents({"email": "ana@mail.com"}) == 1
    assert email_outbox[-1].template == "verify_email"
    assert email_outbox[-1].language == "en"

    # Without verifying, the account cannot sign in (FR-003).
    login = await client.post(
        "/auth/login", json={"email": "ana@mail.com", "password": "secret-123"}
    )
    assert login.status_code == 401


async def test_verification_creates_the_user_atomically(client, db, email_outbox):
    await _register(client, firstName="  Ana ", language="en")
    code = last_code(email_outbox, "ana@mail.com")
    response = await client.post(
        "/auth/register/verify", json={"email": "ana@mail.com", "code": code}
    )
    assert response.status_code == 201
    user = await db.users.find_one({"email": "ana@mail.com"})
    assert user["authProviders"] == ["email"]
    assert user["firstName"] == "Ana"
    assert user["preferences"] == {"language": "en", "defaultCurrency": None, "theme": "system"}
    assert await db.pending_registrations.count_documents({}) == 0
    assert await actions(db, user["_id"]) == [
        "user.registered",
        "user.email_verified",
    ]
    assert await db.refresh_tokens.count_documents({"userId": user["_id"]}) == 1


async def test_registering_again_replaces_the_pending_registration(client, db):
    await _register(client)
    await db.auth_attempts.delete_many({})
    await _register(client, firstName="Ana")
    pending = await db.pending_registrations.find_one({})
    assert pending["firstName"] == "Ana"
    assert await db.pending_registrations.count_documents({}) == 1


async def test_existing_email_gets_account_exists_email(client, db, create_user, email_outbox):
    await create_user(email="ana@mail.com", language="en")
    response = await _register(client, email="Ana@Mail.com ")
    assert response.status_code == 202
    assert await db.users.count_documents({}) == 1
    assert await db.pending_registrations.count_documents({}) == 0
    assert [(e.to, e.template, e.language) for e in email_outbox] == [
        ("ana@mail.com", "account_exists", "en")
    ]


async def test_email_is_case_and_space_insensitive(client, db, email_outbox):
    await _register(client, email=" Ana@Mail.com ")
    code = last_code(email_outbox, "ana@mail.com")
    await client.post("/auth/register/verify", json={"email": "ANA@mail.com", "code": code})
    assert await db.users.count_documents({"email": "ana@mail.com"}) == 1


async def test_rate_limit_applies_the_same_to_new_and_existing_emails(client, create_user):
    await create_user(email="taken@mail.com")
    for email in ("new@mail.com", "taken@mail.com"):
        assert (await _register(client, email=email)).status_code == 202
        assert (await _register(client, email=email)).status_code == 429
