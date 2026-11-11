import pytest
from bson import ObjectId

from tests.conftest import auth_headers

ACCOUNT_FIELDS = {
    "id",
    "name",
    "description",
    "icon",
    "currency",
    "currencyDecimals",
    "isClosed",
    "closedAt",
    "isOwner",
    "myParticipantId",
    "participants",
    "inviteCode",
    "createdAt",
    "updatedAt",
}
SUMMARY_FIELDS = {
    "id",
    "name",
    "icon",
    "currency",
    "isClosed",
    "isOwner",
    "participantCount",
    "updatedAt",
    "currencyDecimals",
    "myBalance",
}


def _payload(**overrides):
    payload = {
        "name": "Vacaciones",
        "currency": "BRL",
        "myParticipantName": "Ana",
        "otherParticipants": ["Leandro", "Javier"],
    }
    payload.update(overrides)
    return payload


async def test_create_returns_account_response(client, create_user):
    user = await create_user()
    response = await client.post("/accounts", json=_payload(), headers=auth_headers(user["_id"]))
    assert response.status_code == 201
    body = response.json()
    assert set(body) == ACCOUNT_FIELDS
    assert body["isOwner"] is True
    assert body["myParticipantId"] == next(p["id"] for p in body["participants"] if p["isMe"])
    assert set(body["participants"][0]) == {"id", "name", "isLinked", "isMe", "isOwner"}
    assert body["currencyDecimals"] == 2


async def test_currency_decimals_follow_the_currency(client, create_user):
    user = await create_user()
    headers = auth_headers(user["_id"])
    yen = await client.post("/accounts", json=_payload(currency="JPY"), headers=headers)
    dinar = await client.post("/accounts", json=_payload(currency="KWD"), headers=headers)
    assert (yen.json()["currencyDecimals"], dinar.json()["currencyDecimals"]) == (0, 3)


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": "  "},
        {"name": "x" * 81},
        {"currency": "XXX1"},
        {"otherParticipants": [""]},
        {"otherParticipants": ["x" * 41]},
        {"otherParticipants": [f"P{i}" for i in range(50)]},
    ],
)
async def test_create_validation_errors(client, create_user, overrides):
    user = await create_user()
    response = await client.post(
        "/accounts", json=_payload(**overrides), headers=auth_headers(user["_id"])
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_create_rejects_duplicate_names(client, create_user):
    user = await create_user()
    response = await client.post(
        "/accounts",
        json=_payload(otherParticipants=["Leandro", "leandro "]),
        headers=auth_headers(user["_id"]),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "duplicate_participant_name"


async def test_list_and_get(client, create_user, create_account):
    owner = await create_user()
    stranger = await create_user(email="other@mail.com")
    account = await create_account(owner)

    listing = await client.get("/accounts", headers=auth_headers(owner["_id"]))
    assert listing.status_code == 200
    assert set(listing.json()[0]) == SUMMARY_FIELDS

    own = await client.get(f"/accounts/{account['_id']}", headers=auth_headers(owner["_id"]))
    assert own.status_code == 200
    foreign = await client.get(f"/accounts/{account['_id']}", headers=auth_headers(stranger["_id"]))
    missing = await client.get(f"/accounts/{ObjectId()}", headers=auth_headers(stranger["_id"]))
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()
    assert foreign.json()["error"]["code"] == "not_found"
