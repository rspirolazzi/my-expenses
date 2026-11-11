import asyncio
import uuid

from tests.conftest import auth_headers, link, participant_id
from tests.contract.test_settlements_create_contract import payload, url


async def balances(client, account, user) -> dict[str, str]:
    response = await client.get(
        f"/accounts/{account['_id']}/balances", headers=auth_headers(user["_id"])
    )
    return {e["participant"]["name"]: e["amount"] for e in response.json()["balances"]}


async def test_stores_integer_minor_units_and_account_currency(
    client, db, create_user, create_account
):
    owner = await create_user()
    account = await create_account(owner, currency="USD")
    response = await client.post(
        url(account), json=payload(account, amount="12.5"), headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 201
    stored = await db.settlements.find_one({})
    assert stored["amountMinor"] == 1250
    assert isinstance(stored["amountMinor"], int)
    assert (stored["currency"], stored["date"], stored["isDeleted"]) == ("USD", "2026-11-11", False)
    assert stored["createdBy"] == owner["_id"]


async def test_unlinked_participants_pay_and_receive(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        url(account),
        json=payload(
            account,
            fromParticipantId=participant_id(account, "Javier"),
            toParticipantId=participant_id(account, "Leandro"),
        ),
        headers=auth_headers(owner["_id"]),
    )
    assert response.status_code == 201


async def test_larger_than_the_debt_flips_the_balance(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    response = await client.post(
        url(account),
        json=payload(account, fromParticipantId=participant_id(account, "Javier"), amount="50.00"),
        headers=auth_headers(owner["_id"]),
    )
    assert response.status_code == 201
    assert await balances(client, account, owner) == {
        "Ana": "10.00",
        "Leandro": "-30.00",
        "Javier": "20.00",
    }


async def test_audit_entry_in_the_same_write(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    account = await create_account(owner)
    leandro = await link(db, account, "Leandro", member)
    response = await client.post(
        url(account), json=payload(account), headers=auth_headers(member["_id"])
    )
    settlement_id = response.json()["id"]
    entry = await db.audit_logs.find_one({"action": "settlement.created"})
    assert entry["accountId"] == account["_id"]
    assert entry["entityType"] == "settlement"
    assert str(entry["entityId"]) == settlement_id
    assert entry["actorUserId"] == member["_id"]
    assert entry["metadata"]["actorParticipantId"] == leandro
    assert entry["metadata"]["source"] == "suggestion"
    assert entry["changes"]["amountMinor"] == {"after": 3000}
    assert set(entry["changes"]) == {
        "date",
        "fromParticipantId",
        "toParticipantId",
        "amountMinor",
        "currency",
    }


async def test_retry_with_the_same_client_request_id(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    body = payload(account, clientRequestId=str(uuid.uuid4()))
    headers = auth_headers(owner["_id"])
    first = await client.post(url(account), json=body, headers=headers)
    second = await client.post(url(account), json=body, headers=headers)
    concurrent = await asyncio.gather(
        *(client.post(url(account), json=body, headers=headers) for _ in range(3))
    )
    responses = [first, second, *concurrent]
    assert {r.status_code for r in responses} == {201}
    assert len({r.json()["id"] for r in responses}) == 1
    assert await db.settlements.count_documents({}) == 1
    assert await db.audit_logs.count_documents({"action": "settlement.created"}) == 1


async def test_closed_account(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, closed=True)
    response = await client.post(
        url(account), json=payload(account), headers=auth_headers(owner["_id"])
    )
    assert (response.status_code, response.json()["error"]["code"]) == (409, "account_closed")
    assert await db.settlements.count_documents({}) == 0


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
            settlement = await db.settlements.find_one({"accountId": account["_id"]})
            current = await db.accounts.find_one({"_id": account["_id"]})
            assert settlement["createdAt"] <= current["closedAt"]
        else:
            assert (created.status_code, created.json()["error"]["code"]) == (
                409,
                "account_closed",
            )
            assert await db.settlements.count_documents({"accountId": account["_id"]}) == 0


async def test_create_racing_with_participant_removal(client, db, create_user, create_account):
    owner = await create_user()
    headers = auth_headers(owner["_id"])
    for attempt in range(20):
        account = await create_account(owner, name=f"Carrera {attempt}")
        leandro = participant_id(account, "Leandro")
        created, removed = await asyncio.gather(
            client.post(url(account), json=payload(account), headers=headers),
            client.delete(f"/accounts/{account['_id']}/participants/{leandro}", headers=headers),
        )
        assert removed.status_code == 200
        if created.status_code == 201:
            # Created before the removal: it stays, excluded from the balances.
            listed = await client.get(url(account), headers=headers)
            assert listed.json()["items"][0]["isExcluded"] is True
        else:
            assert (created.status_code, created.json()["error"]["code"]) == (
                422,
                "invalid_participant",
            )
            assert await db.settlements.count_documents({"accountId": account["_id"]}) == 0


async def test_balances_and_suggestions_are_recalculated(
    client, create_user, create_account, create_expense
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    headers = auth_headers(owner["_id"])
    response = await client.post(url(account), json=payload(account), headers=headers)
    assert response.status_code == 201
    body = (await client.get(f"/accounts/{account['_id']}/balances", headers=headers)).json()
    assert [e["amount"] for e in body["balances"]] == ["30.00", "0.00", "-30.00"]
    assert [(s["from"]["name"], s["to"]["name"], s["amount"]) for s in body["suggestions"]] == [
        ("Javier", "Ana", "30.00")
    ]
