import logging
import uuid

from app.repositories import audit_logs
from tests.conftest import auth_headers, link, participant_id
from tests.contract.test_expenses_create_contract import payload
from tests.contract.test_expenses_edit_contract import body as edit_body

HISTORY_FIELDS = {"id", "action", "actorName", "reason", "at", "changes"}


async def _history(client, account, expense_id, user):
    return await client.get(
        f"/accounts/{account['_id']}/expenses/{expense_id}/history",
        headers=auth_headers(user["_id"]),
    )


async def test_readable_history(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    javier = participant_id(account, "Javier")
    base = f"/accounts/{account['_id']}/expenses"

    created = await client.post(
        base, json=payload(account, amount="90"), headers=auth_headers(owner["_id"])
    )
    expense_id = created.json()["id"]
    await client.put(
        f"{base}/{expense_id}",
        json=edit_body(account, amount="120", paidById=javier),
        headers=auth_headers(member["_id"]),
    )
    await client.delete(
        f"/accounts/{account['_id']}/participants/{javier}", headers=auth_headers(owner["_id"])
    )
    # The actor's current participant name is shown after a rename.
    await client.patch(
        f"/accounts/{account['_id']}/participants/{participant_id(account, 'Leandro')}",
        json={"name": "Lea"},
        headers=auth_headers(owner["_id"]),
    )

    response = await _history(client, account, expense_id, owner)
    assert response.status_code == 200
    entries = response.json()
    assert [e["action"] for e in entries] == ["updated", "updated", "created"]
    assert all(set(e) == HISTORY_FIELDS for e in entries)

    adjustment, edit, creation = entries
    assert (adjustment["reason"], adjustment["actorName"]) == ("participant_removed", "Ana")
    paid_by = next(c for c in adjustment["changes"] if c["field"] == "paidBy")
    assert paid_by == {"field": "paidBy", "before": {"id": javier, "name": "Javier"}, "after": None}

    assert (edit["actorName"], edit["reason"]) == ("Lea", None)
    amount = next(c for c in edit["changes"] if c["field"] == "amount")
    assert (amount["before"], amount["after"]) == ("90.00", "120.00")

    assert creation["actorName"] == "Ana"
    participants = next(c for c in creation["changes"] if c["field"] == "participants")
    assert [p["name"] for p in participants["after"]] == ["Ana", "Lea", "Javier"]

    text = response.text
    assert str(owner["_id"]) not in text and "mail.com" not in text
    assert "actorUserId" not in text


async def test_history_access(client, create_user, create_account, create_expense):
    owner = await create_user()
    stranger = await create_user(email="stranger@mail.com")
    account = await create_account(owner, closed=True)
    expense = await create_expense(account, owner)
    deleted = await create_expense(account, owner, deleted=True)
    assert (await _history(client, account, expense["_id"], owner)).status_code == 200
    assert (await _history(client, account, deleted["_id"], owner)).status_code == 404
    other = await _history(client, account, expense["_id"], stranger)
    assert (other.status_code, other.json()["error"]["code"]) == (404, "not_found")


def test_audit_entries_cannot_be_edited_through_the_repository():
    assert not any(hasattr(audit_logs, name) for name in ("update", "delete", "replace"))


async def test_expense_flows_leave_no_details_in_logs(client, create_user, create_account, caplog):
    caplog.set_level(logging.INFO)
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    base = f"/accounts/{account['_id']}/expenses"
    created = await client.post(
        base,
        json=payload(
            account,
            title="Hotel secreto",
            description="nota privada",
            amount="98765.43",
            clientRequestId=str(uuid.uuid4()),
        ),
        headers=headers,
    )
    expense_id = created.json()["id"]
    await client.put(
        f"{base}/{expense_id}", json=edit_body(account, title="Hotel secreto 2"), headers=headers
    )
    await client.get(f"{base}/{expense_id}/history", headers=headers)
    await client.delete(f"{base}/{expense_id}", params={"version": 2}, headers=headers)
    for secret in ("Hotel secreto", "nota privada", "98765", "Leandro", "Javier"):
        assert secret not in caplog.text
