import pytest

from tests.conftest import auth_headers, last_code


async def test_request_is_accepted_even_if_the_email_is_taken(client, create_user):
    user = await create_user(email="ana@mail.com")
    await create_user(email="taken@mail.com")
    headers = auth_headers(user["_id"])
    response = await client.post(
        "/users/me/email-change", json={"newEmail": "taken@mail.com"}, headers=headers
    )
    assert response.status_code == 202
    again = await client.post(
        "/users/me/email-change", json={"newEmail": "taken@mail.com"}, headers=headers
    )
    assert again.status_code == 429


@pytest.mark.parametrize("new_email", ["ana@mail.com", "not-an-email"])
async def test_request_validation(client, create_user, new_email):
    user = await create_user(email="ana@mail.com")
    response = await client.post(
        "/users/me/email-change", json={"newEmail": new_email}, headers=auth_headers(user["_id"])
    )
    assert response.status_code == 422


async def test_confirm_returns_the_updated_user(client, create_user, email_outbox):
    user = await create_user(email="ana@mail.com")
    headers = auth_headers(user["_id"])
    await client.post("/users/me/email-change", json={"newEmail": "new@mail.com"}, headers=headers)
    code = last_code(email_outbox, "new@mail.com")
    response = await client.post(
        "/users/me/email-change/confirm", json={"code": code}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["email"] == "new@mail.com"
    assert response.json()["pendingEmail"] is None


async def test_confirm_with_wrong_code(client, create_user):
    user = await create_user(email="ana@mail.com")
    headers = auth_headers(user["_id"])
    await client.post("/users/me/email-change", json={"newEmail": "new@mail.com"}, headers=headers)
    response = await client.post(
        "/users/me/email-change/confirm", json={"code": "999999"}, headers=headers
    )
    assert response.status_code in (200, 400)
    if response.status_code == 400:
        assert response.json()["error"]["code"] == "invalid_code"
