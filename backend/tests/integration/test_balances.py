from decimal import Decimal

from tests.conftest import auth_headers, link, participant_id


def url(account) -> str:
    return f"/accounts/{account['_id']}/balances"


async def get_balances(client, account, user) -> dict:
    response = await client.get(url(account), headers=auth_headers(user["_id"]))
    assert response.status_code == 200
    return response.json()


def amounts(body: dict) -> dict[str, str]:
    return {entry["participant"]["name"]: entry["amount"] for entry in body["balances"]}


def total(body: dict) -> Decimal:
    return sum((Decimal(entry["amount"]) for entry in body["balances"]), Decimal(0))


async def test_sum_is_zero_and_deleted_expenses_do_not_count(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=10000)
    await create_expense(
        account, owner, amount_minor=5000, paid_by=participant_id(account, "Javier"), deleted=True
    )
    body = await get_balances(client, account, owner)
    # Shares 33.34 / 33.33 / 33.33: the extra cent is Ana's, first in the account order.
    assert amounts(body) == {"Ana": "66.66", "Leandro": "-33.33", "Javier": "-33.33"}
    assert total(body) == 0


async def test_pending_expense_counts_again_once_completed(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    javier = participant_id(account, "Javier")
    await create_expense(account, owner, amount_minor=9000)
    pending = await create_expense(account, owner, amount_minor=3000, participants=[javier])
    removal = await client.delete(
        f"/accounts/{account['_id']}/participants/{javier}", headers=headers
    )
    assert removal.status_code == 200

    body = await get_balances(client, account, owner)
    assert body["pendingExpenses"] == 1
    assert amounts(body) == {"Ana": "45.00", "Leandro": "-45.00"}
    assert total(body) == 0

    completed = await client.put(
        f"/accounts/{account['_id']}/expenses/{pending['_id']}",
        json={
            "date": "2026-11-11",
            "title": "Cena",
            "amount": "30.00",
            "paidById": participant_id(account, "Ana"),
            "participantIds": [participant_id(account, "Leandro")],
            "categoryIcon": "food",
            "version": 2,
        },
        headers=headers,
    )
    assert completed.status_code == 200
    body = await get_balances(client, account, owner)
    assert body["pendingExpenses"] == 0
    assert amounts(body) == {"Ana": "75.00", "Leandro": "-75.00"}


async def test_closed_account_answers_the_same(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    before = await get_balances(client, account, owner)
    await db.accounts.update_one({"_id": account["_id"]}, {"$set": {"isClosed": True}})
    assert await get_balances(client, account, owner) == before


async def test_member_who_left_keeps_the_balance(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    await create_expense(account, member, amount_minor=9000)
    left = await client.post(
        f"/accounts/{account['_id']}/leave", headers=auth_headers(member["_id"])
    )
    assert left.status_code == 204
    body = await get_balances(client, account, owner)
    assert amounts(body)["Leandro"] == "60.00"
    assert total(body) == 0


async def test_removed_participant_is_not_listed_and_sum_stays_zero(
    client, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    javier = participant_id(account, "Javier")
    ana = participant_id(account, "Ana")
    await create_expense(account, owner, amount_minor=9000)
    await create_settlement(account, owner, javier, ana, amount_minor=1000)
    response = await client.delete(
        f"/accounts/{account['_id']}/participants/{javier}", headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    body = await get_balances(client, account, owner)
    assert amounts(body) == {"Ana": "45.00", "Leandro": "-45.00"}
    assert total(body) == 0


async def test_settlements_move_the_balances(
    client, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    leandro, ana = participant_id(account, "Leandro"), participant_id(account, "Ana")
    await create_settlement(account, owner, leandro, ana, amount_minor=3000)
    await create_settlement(account, owner, leandro, ana, amount_minor=500, deleted=True)
    body = await get_balances(client, account, owner)
    assert amounts(body) == {"Ana": "30.00", "Leandro": "0.00", "Javier": "-30.00"}
    assert len(body["suggestions"]) == 1


async def test_currency_without_decimals(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner, currency="JPY")
    await create_expense(account, owner, amount_minor=1000)
    body = await get_balances(client, account, owner)
    assert body["currencyDecimals"] == 0
    assert amounts(body) == {"Ana": "666", "Leandro": "-333", "Javier": "-333"}


async def test_no_debts(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    body = await get_balances(client, account, owner)
    assert set(amounts(body).values()) == {"0.00"}
    assert body["suggestions"] == []


async def test_other_accounts_do_not_mix(
    client, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    other = await create_account(owner, name="Otra")
    await create_expense(account, owner, amount_minor=9000)
    await create_expense(other, owner, amount_minor=30000)
    await create_settlement(
        other, owner, participant_id(other, "Leandro"), participant_id(other, "Ana"), 10000
    )
    body = await get_balances(client, account, owner)
    assert amounts(body) == {"Ana": "60.00", "Leandro": "-30.00", "Javier": "-30.00"}
