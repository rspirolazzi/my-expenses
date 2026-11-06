import pytest

from tests.conftest import last_code


async def test_request_is_accepted_and_limited_whether_or_not_the_email_exists(client, create_user):
    await create_user(email="ana@mail.com")
    for email in ("ana@mail.com", "nobody@mail.com"):
        assert (await client.post("/auth/password-reset", json={"email": email})).status_code == 202
        assert (await client.post("/auth/password-reset", json={"email": email})).status_code == 429


async def test_confirm_returns_auth_response(client, create_user, email_outbox):
    await create_user(email="ana@mail.com")
    await client.post("/auth/password-reset", json={"email": "ana@mail.com"})
    code = last_code(email_outbox, "ana@mail.com")
    response = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "ana@mail.com", "code": code, "newPassword": "brand-new-password"},
    )
    assert response.status_code == 200
    assert set(response.json()) == {"tokens", "user", "isNewUser"}


async def test_confirm_with_wrong_code(client, create_user):
    await create_user(email="ana@mail.com")
    response = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "ana@mail.com", "code": "123456", "newPassword": "brand-new-password"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


@pytest.mark.parametrize("new_password", ["1234567", "ana@mail.com"])
async def test_confirm_rejects_weak_passwords(client, create_user, new_password):
    await create_user(email="ana@mail.com")
    response = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "ana@mail.com", "code": "123456", "newPassword": new_password},
    )
    assert response.status_code == 422
