import uuid
from datetime import UTC, datetime, timedelta

from tests.conftest import auth_headers, participant_id
from tests.contract.test_expenses_create_contract import payload


def url(account):
    return f"/accounts/{account['_id']}/expenses"


async def test_order_by_day_then_last_loaded(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    base = datetime(2026, 11, 1, tzinfo=UTC)
    await create_expense(account, owner, title="old", date="2026-11-01", created_at=base)
    await create_expense(
        account, owner, title="first", date="2026-11-10", created_at=base + timedelta(hours=1)
    )
    await create_expense(
        account, owner, title="second", date="2026-11-10", created_at=base + timedelta(hours=2)
    )
    await create_expense(account, owner, title="future", date="2030-01-01", created_at=base)
    body = (await client.get(url(account), headers=auth_headers(owner["_id"]))).json()
    assert [item["title"] for item in body["items"]] == ["future", "second", "first", "old"]


async def test_deleted_are_hidden_and_pending_are_counted(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=1000, deleted=True)
    pending = await create_expense(account, owner, amount_minor=500)
    from app.db.client import get_database

    await get_database().expenses.update_one({"_id": pending["_id"]}, {"$set": {"paidById": None}})
    body = (await client.get(url(account), headers=auth_headers(owner["_id"]))).json()
    assert (body["total"], body["count"]) == ("5.00", 1)
    assert body["items"][0]["paidBy"] is None
    assert body["items"][0]["isPending"] is True


async def test_pages_of_50_without_repeats(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    base = datetime(2026, 11, 1, tzinfo=UTC)
    for index in range(120):
        await create_expense(
            account,
            owner,
            title=f"e{index}",
            date=f"2026-11-{1 + index % 5:02d}",
            created_at=base + timedelta(minutes=index),
        )
    headers = auth_headers(owner["_id"])
    seen: list[str] = []
    sizes = []
    cursor = None
    while True:
        params = {"limit": 50, **({"cursor": cursor} if cursor else {})}
        body = (await client.get(url(account), params=params, headers=headers)).json()
        sizes.append(len(body["items"]))
        seen += [item["id"] for item in body["items"]]
        cursor = body["nextCursor"]
        if cursor is None:
            break
    assert sizes == [50, 50, 20]
    assert len(seen) == len(set(seen)) == 120


async def test_new_expense_between_pages_does_not_shift_them(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    base = datetime(2026, 11, 1, tzinfo=UTC)
    for index in range(4):
        await create_expense(
            account, owner, date="2026-11-01", created_at=base + timedelta(minutes=index)
        )
    headers = auth_headers(owner["_id"])
    first = (await client.get(url(account), params={"limit": 2}, headers=headers)).json()
    await client.post(
        url(account),
        json=payload(account, date="2026-11-01", clientRequestId=str(uuid.uuid4())),
        headers=headers,
    )
    second = (
        await client.get(
            url(account), params={"limit": 2, "cursor": first["nextCursor"]}, headers=headers
        )
    ).json()
    ids = [i["id"] for i in first["items"]] + [i["id"] for i in second["items"]]
    assert len(ids) == len(set(ids)) == 4


async def test_payer_name_and_closed_or_deleted_accounts(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner, closed=True)
    await create_expense(account, owner, paid_by=participant_id(account, "Javier"))
    body = (await client.get(url(account), headers=auth_headers(owner["_id"]))).json()
    assert body["items"][0]["paidBy"]["name"] == "Javier"

    deleted = await create_account(owner, name="Borrada", deleted=True)
    gone = await client.get(url(deleted), headers=auth_headers(owner["_id"]))
    assert gone.status_code == 404
