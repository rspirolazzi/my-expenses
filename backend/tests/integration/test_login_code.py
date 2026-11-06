from tests.conftest import actions, last_code


async def test_unknown_email_gets_no_code_but_same_limits(client, db, email_outbox):
    assert (
        await client.post("/auth/login-code", json={"email": "nobody@mail.com"})
    ).status_code == 202
    assert await db.verification_codes.count_documents({}) == 0
    assert email_outbox == []
    assert (
        await client.post("/auth/login-code", json={"email": "nobody@mail.com"})
    ).status_code == 429


async def test_google_only_user_can_sign_in_with_a_code(client, db, create_user, email_outbox):
    user = await create_user(
        email="ana@gmail.com", password=None, google_subject="g-1", language="en"
    )
    await client.post("/auth/login-code", json={"email": "ana@gmail.com"})
    assert email_outbox[-1].template == "login_code"
    assert email_outbox[-1].language == "en"
    code = last_code(email_outbox, "ana@gmail.com")
    response = await client.post(
        "/auth/login-code/verify", json={"email": "ana@gmail.com", "code": code}
    )
    assert response.status_code == 200
    entry = await db.audit_logs.find_one({"action": "user.login_succeeded"})
    assert entry["metadata"]["method"] == "code"
    assert await actions(db, user["_id"]) == ["user.login_succeeded"]


async def test_code_login_works_while_password_login_is_locked(client, create_user, email_outbox):
    await create_user(email="ana@mail.com")
    for _ in range(10):
        await client.post("/auth/login", json={"email": "ana@mail.com", "password": "wrong"})
    locked = await client.post(
        "/auth/login", json={"email": "ana@mail.com", "password": "correct-password"}
    )
    assert locked.status_code == 423
    await client.post("/auth/login-code", json={"email": "ana@mail.com"})
    code = last_code(email_outbox, "ana@mail.com")
    response = await client.post(
        "/auth/login-code/verify", json={"email": "ana@mail.com", "code": code}
    )
    assert response.status_code == 200
