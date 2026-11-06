from tests.conftest import last_code


async def test_request_is_accepted_whether_or_not_the_email_exists(client, create_user):
    await create_user(email="ana@mail.com")
    for email in ("ana@mail.com", "nobody@mail.com"):
        first = await client.post("/auth/login-code", json={"email": email})
        assert first.status_code == 202
        assert first.json() == {"status": "accepted"}
        second = await client.post("/auth/login-code", json={"email": email})
        assert second.status_code == 429
        assert second.json()["error"]["retryAfterSeconds"] > 0


async def test_verify_returns_auth_response_or_invalid_code(client, create_user, email_outbox):
    await create_user(email="ana@mail.com")
    await client.post("/auth/login-code", json={"email": "ana@mail.com"})
    code = last_code(email_outbox, "ana@mail.com")
    response = await client.post(
        "/auth/login-code/verify", json={"email": "ana@mail.com", "code": code}
    )
    assert response.status_code == 200
    assert response.json()["isNewUser"] is False
    reused = await client.post(
        "/auth/login-code/verify", json={"email": "ana@mail.com", "code": code}
    )
    assert reused.status_code == 400
    assert reused.json()["error"]["code"] == "invalid_code"
