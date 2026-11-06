import pytest

from tests.conftest import auth_headers

USER_FIELDS = {
    "id",
    "email",
    "firstName",
    "lastName",
    "authProviders",
    "hasPasswordSet",
    "pendingEmail",
    "preferences",
    "createdAt",
    "updatedAt",
}


async def test_get_me_requires_a_token(client):
    response = await client.get("/users/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_get_me_rejects_an_invalid_token(client):
    response = await client.get("/users/me", headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401


async def test_get_me_returns_the_user_in_camel_case(client, create_user):
    user = await create_user(first_name="Ana")
    response = await client.get("/users/me", headers=auth_headers(user["_id"]))
    assert response.status_code == 200
    body = response.json()
    assert set(body) == USER_FIELDS
    assert body["firstName"] == "Ana"
    assert body["hasPasswordSet"] is True
    assert set(body["preferences"]) == {"language", "defaultCurrency", "theme"}
    assert "passwordHash" not in response.text


async def test_error_message_follows_accept_language(client):
    response = await client.get("/users/me", headers={"Accept-Language": "en-US,en;q=0.9"})
    assert response.json()["error"]["message"] == "You need to sign in."


async def test_patch_me_partial_update_and_null_clears(client, create_user):
    user = await create_user(first_name="Ana", last_name="García")
    headers = auth_headers(user["_id"])
    response = await client.patch(
        "/users/me",
        json={"firstName": None, "preferences": {"theme": "dark", "defaultCurrency": "usd"}},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["firstName"] is None
    assert body["lastName"] == "García"
    assert body["preferences"] == {"language": "es", "defaultCurrency": "USD", "theme": "dark"}


@pytest.mark.parametrize(
    "payload",
    [
        {"preferences": {"defaultCurrency": "XXX1"}},
        {"preferences": {"defaultCurrency": "ABC"}},
        {"preferences": {"language": "fr"}},
        {"preferences": {"theme": "blue"}},
        {"firstName": "x" * 61},
    ],
)
async def test_patch_me_validation_errors(client, create_user, payload):
    user = await create_user()
    response = await client.patch("/users/me", json=payload, headers=auth_headers(user["_id"]))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
