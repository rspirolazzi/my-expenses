import asyncio

from app.services.expense_service import diff_expense
from tests.conftest import auth_headers, link, participant_id
from tests.contract.test_expenses_edit_contract import body


async def test_member_edits_expense_loaded_by_another(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    # Same date as body(), so the diff never depends on the day the suite runs.
    expense = await create_expense(account, owner, date="2026-11-11")
    javier = participant_id(account, "Javier")
    response = await client.put(
        f"/accounts/{account['_id']}/expenses/{expense['_id']}",
        json=body(account, paidById=javier, amount="90"),
        headers=auth_headers(member["_id"]),
    )
    assert response.status_code == 200
    assert response.json()["paidBy"]["name"] == "Javier"
    entry = await db.audit_logs.find_one({"action": "expense.updated"})
    assert set(entry["changes"]) == {"amountMinor", "paidById"}
    assert entry["changes"]["amountMinor"] == {"before": 10000, "after": 9000}
    assert entry["accountId"] == account["_id"]
    assert entry["actorUserId"] == member["_id"]


async def test_same_validations_as_create(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner)
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"
    headers = auth_headers(owner["_id"])
    for bad in ({"amount": "0"}, {"title": " "}, {"participantIds": []}, {"currency": "USD"}):
        assert (
            await client.put(url, json=body(account, **bad), headers=headers)
        ).status_code == 422
    unknown = await client.put(url, json=body(account, paidById="nope"), headers=headers)
    assert unknown.json()["error"]["code"] == "invalid_participant"


async def test_concurrent_edits_keep_the_first(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner)
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"
    headers = auth_headers(owner["_id"])
    first, second = await asyncio.gather(
        client.put(url, json=body(account, amount="120"), headers=headers),
        client.put(url, json=body(account, amount="130"), headers=headers),
    )
    statuses = sorted([first.status_code, second.status_code])
    assert statuses == [200, 409]
    winner = first if first.status_code == 200 else second
    stored = await db.expenses.find_one({"_id": expense["_id"]})
    assert stored["version"] == 2
    assert f"{stored['amountMinor'] // 100}.00" == winner.json()["amount"]


async def test_editing_a_deleted_expense_gives_404(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner, deleted=True)
    response = await client.put(
        f"/accounts/{account['_id']}/expenses/{expense['_id']}",
        json=body(account),
        headers=auth_headers(owner["_id"]),
    )
    assert response.status_code == 404


async def test_logical_delete(client, db, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner, amount_minor=1000)
    await create_expense(account, owner, amount_minor=500)
    headers = auth_headers(owner["_id"])
    url = f"/accounts/{account['_id']}/expenses/{expense['_id']}"
    assert (await client.delete(url, params={"version": 1}, headers=headers)).status_code == 204

    stored = await db.expenses.find_one({"_id": expense["_id"]})
    assert stored["isDeleted"] is True
    assert stored["deletedAt"] is not None
    assert await db.audit_logs.count_documents({"action": "expense.deleted"}) == 1
    listing = (await client.get(f"/accounts/{account['_id']}/expenses", headers=headers)).json()
    assert (listing["total"], listing["count"]) == ("5.00", 1)
    assert (await client.get(url, headers=headers)).status_code == 404


async def test_completing_a_pending_expense(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    expense = await create_expense(account, owner, participants=[])
    await db.expenses.update_one({"_id": expense["_id"]}, {"$set": {"paidById": None}})
    response = await client.put(
        f"/accounts/{account['_id']}/expenses/{expense['_id']}",
        json=body(account),
        headers=auth_headers(owner["_id"]),
    )
    assert response.status_code == 200
    assert response.json()["isPending"] is False


def test_diff_only_includes_changed_fields():
    before = {"title": "a", "amountMinor": 1, "participantIds": ["x", "y"], "description": None}
    after = {"title": "a", "amountMinor": 2, "participantIds": ["x", "y"], "description": None}
    assert diff_expense(before, after) == {"amountMinor": {"before": 1, "after": 2}}
    assert diff_expense(before, {**before, "participantIds": ["x"]}) == {
        "participantIds": {"before": ["x", "y"], "after": ["x"]}
    }
