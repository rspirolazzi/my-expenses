import uuid

import pytest

from tests.conftest import auth_headers, participant_id

SETTLEMENT_FIELDS = {
    "id",
    "accountId",
    "date",
    "from",
    "to",
    "amount",
    "currency",
    "isExcluded",
    "createdAt",
}


def url(account) -> str:
    return f"/accounts/{account['_id']}/settlements"


def payload(account, **overrides):
    body = {
        "fromParticipantId": participant_id(account, "Leandro"),
        "toParticipantId": participant_id(account, "Ana"),
        "amount": "30.00",
        "date": "2026-11-11",
        "clientRequestId": str(uuid.uuid4()),
        "source": "suggestion",
    }
    body.update(overrides)
    return body


async def test_create_returns_settlement_response(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        url(account), json=payload(account), headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body) == SETTLEMENT_FIELDS
    assert body["accountId"] == str(account["_id"])
    assert body["from"] == {"id": participant_id(account, "Leandro"), "name": "Leandro"}
    assert body["to"] == {"id": participant_id(account, "Ana"), "name": "Ana"}
    assert (body["amount"], body["currency"], body["date"]) == ("30.00", "ARS", "2026-11-11")
    assert body["isExcluded"] is False


async def test_source_defaults_to_manual(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    body = payload(account)
    del body["source"]
    response = await client.post(url(account), json=body, headers=auth_headers(owner["_id"]))
    assert response.status_code == 201


@pytest.mark.parametrize(
    "overrides",
    [
        {"amount": "0"},
        {"amount": "-1"},
        {"amount": "10.555"},
        {"amount": "1000000000"},
        {"amount": 10},
        {"date": "2026-02-30"},
        {"currency": "USD"},
        {"receiptUrl": "x"},
        {"source": "other"},
        {"clientRequestId": None},
    ],
    ids=[
        "zero",
        "negative",
        "too-many-decimals",
        "too-large",
        "number",
        "bad-date",
        "currency",
        "unknown-field",
        "bad-source",
        "no-client-request-id",
    ],
)
async def test_validation_errors(client, create_user, create_account, overrides):
    owner = await create_user()
    account = await create_account(owner)
    body = {k: v for k, v in payload(account, **overrides).items() if v is not None}
    response = await client.post(url(account), json=body, headers=auth_headers(owner["_id"]))
    assert (response.status_code, response.json()["error"]["code"]) == (422, "validation_error")


async def test_same_participant_on_both_sides(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    ana = participant_id(account, "Ana")
    response = await client.post(
        url(account),
        json=payload(account, fromParticipantId=ana, toParticipantId=ana),
        headers=auth_headers(owner["_id"]),
    )
    assert (response.status_code, response.json()["error"]["code"]) == (422, "validation_error")


async def test_invalid_participants(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    other = await create_account(owner, name="Otra")
    headers = auth_headers(owner["_id"])
    javier = participant_id(account, "Javier")
    await client.delete(f"/accounts/{account['_id']}/participants/{javier}", headers=headers)
    cases = [
        {"fromParticipantId": "missing"},
        {"fromParticipantId": javier},
        {"toParticipantId": participant_id(other, "Ana")},
    ]
    for overrides in cases:
        response = await client.post(
            url(account), json=payload(account, **overrides), headers=headers
        )
        assert (response.status_code, response.json()["error"]["code"]) == (
            422,
            "invalid_participant",
        )
    assert await db.settlements.count_documents({}) == 0


async def test_not_found_for_outsiders(client, create_user, create_account):
    owner = await create_user()
    outsider = await create_user(email="otro@mail.com")
    account = await create_account(owner)
    response = await client.post(
        url(account), json=payload(account), headers=auth_headers(outsider["_id"])
    )
    assert (response.status_code, response.json()["error"]["code"]) == (404, "not_found")
