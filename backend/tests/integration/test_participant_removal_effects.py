import asyncio
import uuid

import pytest

from app.services import audit_service
from tests.conftest import auth_headers, participant_id
from tests.contract.test_expenses_create_contract import payload


async def _remove(client, account, user, pid):
    return await client.delete(
        f"/accounts/{account['_id']}/participants/{pid}", headers=auth_headers(user["_id"])
    )


async def test_removal_adjusts_expenses(client, db, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    ana, leandro, javier = (participant_id(account, n) for n in ("Ana", "Leandro", "Javier"))
    paid = await create_expense(account, owner, paid_by=javier, participants=[ana, leandro])
    shared = await create_expense(account, owner, participants=[ana, leandro, javier])
    only = await create_expense(account, owner, participants=[javier])
    untouched = await create_expense(account, owner, participants=[ana])
    deleted = await create_expense(account, owner, paid_by=javier, deleted=True)

    assert (await _remove(client, account, owner, javier)).status_code == 200

    stored = {doc["_id"]: doc async for doc in db.expenses.find({})}
    assert stored[paid["_id"]]["paidById"] is None
    assert stored[shared["_id"]]["participantIds"] == [ana, leandro]
    assert stored[only["_id"]]["participantIds"] == []
    assert stored[deleted["_id"]]["paidById"] == javier
    assert stored[untouched["_id"]]["version"] == 1
    for expense in (paid, shared, only):
        assert stored[expense["_id"]]["version"] == 2

    headers = auth_headers(owner["_id"])
    detail = (
        await client.get(f"/accounts/{account['_id']}/expenses/{shared['_id']}", headers=headers)
    ).json()
    assert [s["amount"] for s in detail["shares"]] == ["50.00", "50.00"]
    for expense in (paid, only):
        item = (
            await client.get(
                f"/accounts/{account['_id']}/expenses/{expense['_id']}", headers=headers
            )
        ).json()
        assert item["isPending"] is True

    entries = [e async for e in db.audit_logs.find({"action": "expense.updated"})]
    assert len(entries) == 3
    for entry in entries:
        assert entry["actorUserId"] == owner["_id"]
        assert entry["metadata"]["reason"] == "participant_removed"
        assert entry["accountId"] == account["_id"]
    by_expense = {e["entityId"]: e["changes"] for e in entries}
    assert by_expense[paid["_id"]] == {"paidById": {"before": javier, "after": None}}
    assert by_expense[only["_id"]] == {"participantIds": {"before": [javier], "after": []}}


async def test_removal_is_all_or_nothing(
    client, db, create_user, create_account, create_expense, monkeypatch
):
    owner = await create_user()
    account = await create_account(owner)
    javier = participant_id(account, "Javier")
    await create_expense(account, owner, paid_by=javier)
    original = audit_service.record

    async def failing(action, **kwargs):
        if action == "expense.updated":
            raise RuntimeError("audit store unavailable")
        return await original(action, **kwargs)

    monkeypatch.setattr(audit_service, "record", failing)
    # The test transport re-raises unexpected errors (the app answers 500 internal_error).
    with pytest.raises(RuntimeError):
        await _remove(client, account, owner, javier)
    current = await db.accounts.find_one({"_id": account["_id"]})
    assert next(p for p in current["participants"] if p["id"] == javier)["removedAt"] is None
    expense = await db.expenses.find_one({})
    assert (expense["paidById"], expense["version"]) == (javier, 1)


async def test_unlinked_participant_removal(
    client, db, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    leandro = participant_id(account, "Leandro")
    await create_expense(account, owner, paid_by=leandro)
    assert (await _remove(client, account, owner, leandro)).status_code == 200
    assert (await db.expenses.find_one({}))["paidById"] is None


@pytest.mark.parametrize("operation", ["create", "edit"])
async def test_racing_with_removal_never_leaves_a_removed_participant(
    client, db, create_user, create_account, create_expense, operation
):
    owner = await create_user()
    headers = auth_headers(owner["_id"])
    for attempt in range(20):
        account = await create_account(owner, name=f"Carrera {attempt}")
        javier = participant_id(account, "Javier")
        base = f"/accounts/{account['_id']}/expenses"
        data = payload(account, clientRequestId=str(uuid.uuid4()), paidById=javier)
        if operation == "create":
            write = client.post(base, json=data, headers=headers)
        else:
            expense = await create_expense(
                account, owner, participants=[participant_id(account, "Ana")]
            )
            del data["clientRequestId"]
            write = client.put(
                f"{base}/{expense['_id']}", json={**data, "version": 1}, headers=headers
            )
        written, removed = await asyncio.gather(write, _remove(client, account, owner, javier))
        assert removed.status_code == 200
        assert written.status_code in (200, 201, 409, 422)
        if written.status_code == 422:
            assert written.json()["error"]["code"] == "invalid_participant"
        async for expense in db.expenses.find({"accountId": account["_id"], "isDeleted": False}):
            assert expense["paidById"] != javier
            assert javier not in expense["participantIds"]
