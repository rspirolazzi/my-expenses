import asyncio

from tests.conftest import auth_headers, participant_id


def url(account, settlement) -> str:
    return f"/accounts/{account['_id']}/settlements/{settlement['_id']}"


async def amounts(client, account, user) -> list[str]:
    response = await client.get(
        f"/accounts/{account['_id']}/balances", headers=auth_headers(user["_id"])
    )
    return [e["amount"] for e in response.json()["balances"]]


async def test_logical_delete_with_audit(
    client, db, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    before = await amounts(client, account, owner)
    settlement = await create_settlement(
        account, owner, participant_id(account, "Leandro"), participant_id(account, "Ana"), 3000
    )
    assert await amounts(client, account, owner) != before
    headers = auth_headers(owner["_id"])

    response = await client.delete(url(account, settlement), headers=headers)
    assert response.status_code == 204
    stored = await db.settlements.find_one({"_id": settlement["_id"]})
    assert stored["isDeleted"] is True
    assert stored["deletedAt"] is not None
    assert stored["deletedBy"] == owner["_id"]
    entry = await db.audit_logs.find_one({"action": "settlement.deleted"})
    assert entry["entityId"] == settlement["_id"]
    assert entry["entityType"] == "settlement"
    assert entry["accountId"] == account["_id"]
    assert entry["changes"] == {"isDeleted": {"before": False, "after": True}}
    assert await amounts(client, account, owner) == before

    again = await client.delete(url(account, settlement), headers=headers)
    assert (again.status_code, again.json()["error"]["code"]) == (404, "not_found")


async def test_concurrent_deletes(client, db, create_user, create_account, create_settlement):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    leandro, ana = participant_id(account, "Leandro"), participant_id(account, "Ana")
    for _ in range(20):
        settlement = await create_settlement(account, owner, leandro, ana)
        responses = await asyncio.gather(
            client.delete(url(account, settlement), headers=headers),
            client.delete(url(account, settlement), headers=headers),
        )
        assert sorted(r.status_code for r in responses) == [204, 404]
        assert (
            await db.audit_logs.count_documents(
                {"action": "settlement.deleted", "entityId": settlement["_id"]}
            )
            == 1
        )


async def test_excluded_settlement_can_be_deleted(
    client, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    javier = participant_id(account, "Javier")
    await create_expense(account, owner, amount_minor=9000)
    settlement = await create_settlement(account, owner, javier, participant_id(account, "Ana"))
    await client.delete(f"/accounts/{account['_id']}/participants/{javier}", headers=headers)
    before = await amounts(client, account, owner)
    response = await client.delete(url(account, settlement), headers=headers)
    assert response.status_code == 204
    assert await amounts(client, account, owner) == before


async def test_closed_account(client, db, create_user, create_account, create_settlement):
    owner = await create_user()
    account = await create_account(owner, closed=True)
    settlement = await create_settlement(
        account, owner, participant_id(account, "Leandro"), participant_id(account, "Ana")
    )
    response = await client.delete(url(account, settlement), headers=auth_headers(owner["_id"]))
    assert (response.status_code, response.json()["error"]["code"]) == (409, "account_closed")
    assert (await db.settlements.find_one({}))["isDeleted"] is False


async def test_outsiders_and_other_accounts(client, create_user, create_account, create_settlement):
    owner = await create_user()
    outsider = await create_user(email="otro@mail.com")
    account = await create_account(owner)
    other = await create_account(owner, name="Otra")
    settlement = await create_settlement(
        other, owner, participant_id(other, "Leandro"), participant_id(other, "Ana")
    )
    as_outsider = await client.delete(url(other, settlement), headers=auth_headers(outsider["_id"]))
    wrong_account = await client.delete(
        url(account, settlement), headers=auth_headers(owner["_id"])
    )
    assert (as_outsider.status_code, wrong_account.status_code) == (404, 404)
