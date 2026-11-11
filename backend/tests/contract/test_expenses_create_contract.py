import uuid

import pytest

from tests.conftest import auth_headers, participant_id

EXPENSE_FIELDS = {
    "id",
    "accountId",
    "date",
    "title",
    "description",
    "amount",
    "currency",
    "categoryIcon",
    "paidBy",
    "participants",
    "shares",
    "isPending",
    "version",
    "createdAt",
    "updatedAt",
}


def payload(account, **overrides):
    body = {
        "date": "2026-11-11",
        "title": "Cena",
        "amount": "100.00",
        "paidById": participant_id(account, "Ana"),
        "participantIds": [p["id"] for p in account["participants"]],
        "categoryIcon": "food",
        "clientRequestId": str(uuid.uuid4()),
    }
    body.update(overrides)
    return body


async def test_create_returns_expense_response(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        f"/accounts/{account['_id']}/expenses",
        json=payload(account),
        headers=auth_headers(owner["_id"]),
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body) == EXPENSE_FIELDS
    assert (body["amount"], body["currency"], body["version"], body["isPending"]) == (
        "100.00",
        "ARS",
        1,
        False,
    )
    assert [s["amount"] for s in body["shares"]] == ["33.34", "33.33", "33.33"]
    assert body["paidBy"] == {"id": participant_id(account, "Ana"), "name": "Ana"}


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 81},
        {"description": "x" * 501},
        {"date": "2026-13-01"},
        {"amount": "0"},
        {"amount": "-1"},
        {"amount": "10.555"},
        {"amount": "1000000000"},
        {"amount": 100},
        {"participantIds": []},
        {"paidById": None},
        {"currency": "USD"},
        {"receiptUrl": "https://example.com/r.jpg"},
        {"categoryIcon": "spaceship"},
    ],
)
async def test_create_validation(client, create_user, create_account, overrides):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        f"/accounts/{account['_id']}/expenses",
        json=payload(account, **overrides),
        headers=auth_headers(owner["_id"]),
    )
    assert (response.status_code, response.json()["error"]["code"]) == (422, "validation_error")


@pytest.mark.parametrize("field", ["paidById", "participantIds"])
async def test_create_rejects_unknown_or_removed_participants(
    client, db, create_user, create_account, field
):
    owner = await create_user()
    account = await create_account(owner)
    javier = participant_id(account, "Javier")
    await db.accounts.update_one(
        {"_id": account["_id"], "participants.id": javier},
        {"$set": {"participants.$.removedAt": account["createdAt"]}},
    )
    headers = auth_headers(owner["_id"])
    url = f"/accounts/{account['_id']}/expenses"
    for bad in ("not-a-participant", javier):
        value = bad if field == "paidById" else [participant_id(account, "Ana"), bad]
        response = await client.post(url, json=payload(account, **{field: value}), headers=headers)
        assert (response.status_code, response.json()["error"]["code"]) == (
            422,
            "invalid_participant",
        )


async def test_get_expense_is_only_for_members(client, create_user, create_account, create_expense):
    owner = await create_user()
    stranger = await create_user(email="stranger@mail.com")
    account = await create_account(owner)
    other_account = await create_account(owner, name="Otra")
    expense = await create_expense(account, owner)
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"

    ok = await client.get(url, headers=auth_headers(owner["_id"]))
    assert ok.status_code == 200
    assert set(ok.json()) == EXPENSE_FIELDS

    missing = [
        await client.get(url, headers=auth_headers(stranger["_id"])),
        await client.get(
            f"/accounts/{account['_id']}/expenses/{other_account['_id']}",
            headers=auth_headers(owner["_id"]),
        ),
        await client.get(
            f"/accounts/{other_account['_id']}/expenses/{expense['_id']}",
            headers=auth_headers(owner["_id"]),
        ),
        await client.get(
            f"/accounts/{account['_id']}/expenses/not-an-id", headers=auth_headers(owner["_id"])
        ),
    ]
    assert {(r.status_code, r.json()["error"]["code"]) for r in missing} == {(404, "not_found")}
