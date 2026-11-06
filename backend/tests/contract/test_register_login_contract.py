import pytest

from tests.conftest import last_code

AUTH_FIELDS = {"tokens", "user", "isNewUser"}


async def test_register_returns_the_same_body_whether_or_not_the_email_exists(client, create_user):
    await create_user(email="taken@mail.com")
    new = await client.post(
        "/auth/register", json={"email": "new@mail.com", "password": "secret-123"}
    )
    taken = await client.post(
        "/auth/register", json={"email": "taken@mail.com", "password": "secret-123"}
    )
    assert new.status_code == taken.status_code == 202
    assert new.json() == taken.json() == {"status": "accepted"}


@pytest.mark.parametrize("password", ["1234567", "ana@mail.com"])
async def test_register_rejects_weak_passwords(client, password):
    response = await client.post(
        "/auth/register", json={"email": "ana@mail.com", "password": password}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert password not in response.text


async def test_resend_is_accepted(client):
    response = await client.post("/auth/register/resend", json={"email": "ana@mail.com"})
    assert response.status_code == 202


async def test_verify_returns_201_auth_response_or_invalid_code(client, email_outbox):
    await client.post("/auth/register", json={"email": "ana@mail.com", "password": "secret-123"})
    wrong = await client.post(
        "/auth/register/verify", json={"email": "ana@mail.com", "code": "000000"}
    )
    code = last_code(email_outbox, "ana@mail.com")
    if code != "000000":
        assert wrong.status_code == 400
        assert wrong.json()["error"]["code"] == "invalid_code"
    response = await client.post(
        "/auth/register/verify", json={"email": "ana@mail.com", "code": code}
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body) == AUTH_FIELDS
    assert body["isNewUser"] is True
    for secret in ("passwordHash", "codeHash", "tokenHash", code):
        assert secret not in response.text


async def test_login_success_and_generic_failure(client, create_user):
    await create_user(email="ana@mail.com", password="correct-password")
    ok = await client.post(
        "/auth/login", json={"email": "ana@mail.com", "password": "correct-password"}
    )
    assert ok.status_code == 200
    assert set(ok.json()) == AUTH_FIELDS

    wrong = await client.post("/auth/login", json={"email": "ana@mail.com", "password": "nope"})
    missing = await client.post(
        "/auth/login", json={"email": "nobody@mail.com", "password": "nope"}
    )
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json() == missing.json()
    assert wrong.json()["error"]["code"] == "invalid_credentials"


async def test_login_locked_returns_423_with_retry_after(client, create_user):
    await create_user(email="ana@mail.com", password="correct-password")
    for _ in range(9):
        await client.post("/auth/login", json={"email": "ana@mail.com", "password": "nope"})
    response = await client.post("/auth/login", json={"email": "ana@mail.com", "password": "nope"})
    assert response.status_code == 423
    error = response.json()["error"]
    assert error["code"] == "password_login_locked"
    assert error["retryAfterSeconds"] > 0
    assert response.headers["Retry-After"] == str(error["retryAfterSeconds"])
