from tests.conftest import auth_headers, link, participant_id


def body(account, **overrides):
    data = {
        "date": "2026-11-11",
        "title": "Cena",
        "amount": "120.00",
        "paidById": participant_id(account, "Ana"),
        "participantIds": [p["id"] for p in account["participants"]],
        "categoryIcon": "food",
        "version": 1,
    }
    data.update(overrides)
    return data


async def test_put_increments_version(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner)
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"
    headers = auth_headers(owner["_id"])

    response = await client.put(url, json=body(account), headers=headers)
    assert response.status_code == 200
    assert (response.json()["version"], response.json()["amount"]) == (2, "120.00")

    missing_version = body(account)
    del missing_version["version"]
    assert (await client.put(url, json=missing_version, headers=headers)).status_code == 422
    assert (
        await client.put(url, json=body(account, paidById=None, version=2), headers=headers)
    ).status_code == 422

    stale = await client.put(url, json=body(account, title="Otra"), headers=headers)
    assert (stale.status_code, stale.json()["error"]["code"]) == (409, "expense_conflict")
    assert stale.json()["current"]["version"] == 2
    assert stale.json()["current"]["amount"] == "120.00"


async def test_delete_with_version(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner)
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"
    headers = auth_headers(owner["_id"])

    stale = await client.delete(url, params={"version": 7}, headers=headers)
    assert (stale.status_code, stale.json()["error"]["code"]) == (409, "expense_conflict")
    assert (await client.delete(url, params={"version": 1}, headers=headers)).status_code == 204
    again = await client.delete(url, params={"version": 1}, headers=headers)
    assert again.status_code == 404
    assert (await client.delete(url, headers=headers)).status_code == 422


async def test_closed_account_and_non_members(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    stranger = await create_user(email="stranger@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    expense = await create_expense(account, owner)
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"

    for user in (stranger,):
        put = await client.put(url, json=body(account), headers=auth_headers(user["_id"]))
        delete = await client.delete(url, params={"version": 1}, headers=auth_headers(user["_id"]))
        assert {put.status_code, delete.status_code} == {404}

    await db.accounts.update_one({"_id": account["_id"]}, {"$set": {"isClosed": True}})
    put = await client.put(url, json=body(account), headers=auth_headers(member["_id"]))
    delete = await client.delete(url, params={"version": 1}, headers=auth_headers(member["_id"]))
    assert {(r.status_code, r.json()["error"]["code"]) for r in (put, delete)} == {
        (409, "account_closed")
    }
