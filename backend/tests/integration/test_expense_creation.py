import asyncio
import uuid

from tests.conftest import auth_headers, participant_id
from tests.contract.test_expenses_create_contract import payload


def url(account):
    return f"/accounts/{account['_id']}/expenses"


async def test_stores_integer_minor_units_in_account_order(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    ids = [p["id"] for p in account["participants"]]
    response = await client.post(
        url(account),
        json=payload(account, amount="100.5", participantIds=list(reversed(ids))),
        headers=auth_headers(owner["_id"]),
    )
    assert response.status_code == 201
    stored = await db.expenses.find_one({})
    assert stored["amountMinor"] == 10050
    assert isinstance(stored["amountMinor"], int)
    assert stored["currency"] == "ARS"
    assert stored["participantIds"] == ids
    assert stored["date"] == "2026-11-11"
    assert [s["amount"] for s in response.json()["shares"]] == ["33.50", "33.50", "33.50"]


async def test_payer_outside_participants_and_unlinked_participants(
    client, create_user, create_account
):
    owner = await create_user()
    account = await create_account(owner)
    leandro, javier = participant_id(account, "Leandro"), participant_id(account, "Javier")
    response = await client.post(
        url(account),
        json=payload(account, paidById=participant_id(account, "Ana"), participantIds=[javier]),
        headers=auth_headers(owner["_id"]),
    )
    body = response.json()
    assert response.status_code == 201
    assert body["shares"] == [{"participant": {"id": javier, "name": "Javier"}, "amount": "100.00"}]

    unlinked_payer = await client.post(
        url(account), json=payload(account, paidById=leandro), headers=auth_headers(owner["_id"])
    )
    assert unlinked_payer.status_code == 201


async def test_currency_without_decimals(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, currency="JPY")
    headers = auth_headers(owner["_id"])
    response = await client.post(
        url(account), json=payload(account, amount="1000"), headers=headers
    )
    assert [s["amount"] for s in response.json()["shares"]] == ["334", "333", "333"]
    decimals = await client.post(
        url(account), json=payload(account, amount="10.5"), headers=headers
    )
    assert decimals.status_code == 422


async def test_future_date_is_allowed(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        url(account), json=payload(account, date="2030-01-15"), headers=auth_headers(owner["_id"])
    )
    assert (response.status_code, response.json()["date"]) == (201, "2030-01-15")


async def test_audit_entry_with_account(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        url(account), json=payload(account), headers=auth_headers(owner["_id"])
    )
    entry = await db.audit_logs.find_one({"action": "expense.created"})
    assert entry["entityType"] == "expense"
    assert str(entry["entityId"]) == response.json()["id"]
    assert entry["accountId"] == account["_id"]
    assert entry["actorUserId"] == owner["_id"]
    assert entry["metadata"]["actorParticipantId"] == participant_id(account, "Ana")
    assert entry["changes"]["amountMinor"] == {"after": 10000}
    assert entry["changes"]["title"] == {"after": "Cena"}


async def test_retry_with_same_client_request_id_creates_one_expense(
    client, db, create_user, create_account
):
    owner = await create_user()
    account = await create_account(owner)
    body = payload(account, clientRequestId=str(uuid.uuid4()))
    headers = auth_headers(owner["_id"])
    first = await client.post(url(account), json=body, headers=headers)
    second = await client.post(url(account), json=body, headers=headers)
    assert (first.status_code, second.status_code) == (201, 201)
    assert first.json()["id"] == second.json()["id"]
    assert await db.expenses.count_documents({}) == 1
    assert await db.audit_logs.count_documents({"action": "expense.created"}) == 1


async def test_concurrent_retries_create_one_expense(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    body = payload(account, clientRequestId=str(uuid.uuid4()))
    headers = auth_headers(owner["_id"])
    responses = await asyncio.gather(
        *(client.post(url(account), json=body, headers=headers) for _ in range(3))
    )
    assert {r.status_code for r in responses} == {201}
    assert len({r.json()["id"] for r in responses}) == 1
    assert await db.expenses.count_documents({}) == 1


async def test_closed_and_deleted_accounts(client, create_user, create_account):
    owner = await create_user()
    closed = await create_account(owner, closed=True)
    deleted = await create_account(owner, name="Borrada", deleted=True)
    headers = auth_headers(owner["_id"])
    response = await client.post(url(closed), json=payload(closed), headers=headers)
    assert (response.status_code, response.json()["error"]["code"]) == (409, "account_closed")
    gone = await client.post(url(deleted), json=payload(deleted), headers=headers)
    assert gone.status_code == 404


async def test_create_racing_with_close(client, db, create_user, create_account):
    owner = await create_user()
    headers = auth_headers(owner["_id"])
    for attempt in range(20):
        account = await create_account(owner, name=f"Carrera {attempt}")
        created, closed = await asyncio.gather(
            client.post(url(account), json=payload(account), headers=headers),
            client.post(f"/accounts/{account['_id']}/close", headers=headers),
        )
        assert closed.status_code == 200
        if created.status_code == 201:
            expense = await db.expenses.find_one({"accountId": account["_id"]})
            assert (
                expense["createdAt"]
                <= (await db.accounts.find_one({"_id": account["_id"]}))["closedAt"]
            )
        else:
            assert (created.status_code, created.json()["error"]["code"]) == (
                409,
                "account_closed",
            )
            assert await db.expenses.count_documents({"accountId": account["_id"]}) == 0
