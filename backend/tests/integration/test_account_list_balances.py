from app.repositories import expenses as expenses_repo
from app.repositories import settlements as settlements_repo
from tests.conftest import auth_headers, link, participant_id


async def my_accounts(client, user) -> dict[str, dict]:
    response = await client.get("/accounts", headers=auth_headers(user["_id"]))
    assert response.status_code == 200
    return {item["name"]: item for item in response.json()}


async def my_entry(client, account, user) -> str:
    response = await client.get(
        f"/accounts/{account['_id']}/balances", headers=auth_headers(user["_id"])
    )
    return next(e["amount"] for e in response.json()["balances"] if e["isMe"])


async def test_my_balance_matches_the_balances_view(
    client, db, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    ars = await create_account(owner, name="ARS")
    usd = await create_account(owner, name="USD", currency="USD")
    closed = await create_account(owner, name="Cerrada")
    for account in (ars, usd, closed):
        await link(db, account, "Leandro", member)
    await create_expense(ars, owner, amount_minor=9000)
    await create_expense(usd, member, amount_minor=3000)
    await create_expense(closed, owner, amount_minor=600)
    await create_settlement(
        ars, owner, participant_id(ars, "Leandro"), participant_id(ars, "Ana"), 1000
    )
    await db.accounts.update_one({"_id": closed["_id"]}, {"$set": {"isClosed": True}})

    for user in (owner, member):
        listed = await my_accounts(client, user)
        for account in (ars, usd, closed):
            item = listed[account["name"]]
            assert item["myBalance"] == await my_entry(client, account, user)
            assert item["currencyDecimals"] == 2
    owner_view = await my_accounts(client, owner)
    assert owner_view["ARS"]["myBalance"] == "50.00"
    assert owner_view["USD"]["myBalance"] == "-10.00"
    assert owner_view["Cerrada"]["myBalance"] == "4.00"
    assert owner_view["Cerrada"]["isClosed"] is True


async def test_empty_account_and_currency_without_decimals(client, create_user, create_account):
    owner = await create_user()
    await create_account(owner, name="Vacía")
    await create_account(owner, name="Yenes", currency="JPY")
    listed = await my_accounts(client, owner)
    assert listed["Vacía"]["myBalance"] == "0.00"
    assert (listed["Yenes"]["myBalance"], listed["Yenes"]["currencyDecimals"]) == ("0", 0)


async def test_left_and_deleted_accounts_are_not_listed(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    left = await create_account(owner, name="Abandonada")
    gone = await create_account(owner, name="Borrada")
    for account in (left, gone):
        await link(db, account, "Leandro", member)
    await client.post(f"/accounts/{left['_id']}/leave", headers=auth_headers(member["_id"]))
    await client.delete(f"/accounts/{gone['_id']}", headers=auth_headers(owner["_id"]))
    assert await my_accounts(client, member) == {}


async def test_two_balance_queries_for_all_accounts(
    client, monkeypatch, create_user, create_account, create_expense
):
    owner = await create_user()
    for i in range(5):
        account = await create_account(owner, name=f"Cuenta {i}")
        await create_expense(account, owner)
    calls: list[str] = []
    for module, name in (
        (expenses_repo, "active_for_balances"),
        (settlements_repo, "active_for_accounts"),
    ):
        original = getattr(module, name)

        async def counted(account_ids, _original=original, _name=name):
            calls.append(_name)
            return await _original(account_ids)

        monkeypatch.setattr(module, name, counted)
    assert len(await my_accounts(client, owner)) == 5
    assert sorted(calls) == ["active_for_accounts", "active_for_balances"]
