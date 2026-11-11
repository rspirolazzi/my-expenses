from tests.conftest import auth_headers, link, participant_id

BALANCES_FIELDS = {"currency", "currencyDecimals", "balances", "suggestions", "pendingExpenses"}


def url(account) -> str:
    return f"/accounts/{account['_id']}/balances"


async def test_returns_account_balances(client, db, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    response = await client.get(url(account), headers=auth_headers(owner["_id"]))
    assert response.status_code == 200
    body = response.json()
    assert set(body) == BALANCES_FIELDS
    assert (body["currency"], body["currencyDecimals"], body["pendingExpenses"]) == ("ARS", 2, 0)
    ana, leandro, javier = (participant_id(account, n) for n in ("Ana", "Leandro", "Javier"))
    assert body["balances"] == [
        {"participant": {"id": ana, "name": "Ana"}, "amount": "60.00", "isMe": True},
        {"participant": {"id": leandro, "name": "Leandro"}, "amount": "-30.00", "isMe": False},
        {"participant": {"id": javier, "name": "Javier"}, "amount": "-30.00", "isMe": False},
    ]
    assert body["suggestions"] == [
        {
            "from": {"id": leandro, "name": "Leandro"},
            "to": {"id": ana, "name": "Ana"},
            "amount": "30.00",
        },
        {
            "from": {"id": javier, "name": "Javier"},
            "to": {"id": ana, "name": "Ana"},
            "amount": "30.00",
        },
    ]


async def test_is_me_follows_the_requesting_user(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    body = (await client.get(url(account), headers=auth_headers(member["_id"]))).json()
    assert [entry["isMe"] for entry in body["balances"]] == [False, True, False]


async def test_not_found_for_outsiders_missing_and_deleted(client, create_user, create_account):
    owner = await create_user()
    outsider = await create_user(email="otro@mail.com")
    account = await create_account(owner)
    deleted = await create_account(owner, name="Borrada", deleted=True)
    responses = [
        await client.get(url(account), headers=auth_headers(outsider["_id"])),
        await client.get(
            "/accounts/000000000000000000000000/balances", headers=auth_headers(owner["_id"])
        ),
        await client.get(url(deleted), headers=auth_headers(owner["_id"])),
    ]
    assert {r.status_code for r in responses} == {404}
    assert len({r.text for r in responses}) == 1
