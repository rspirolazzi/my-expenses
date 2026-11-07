from datetime import UTC, datetime, timedelta

from tests.conftest import actions, auth_headers


async def test_creator_is_owner_and_linked_participant(client, db, create_user):
    user = await create_user()
    response = await client.post(
        "/accounts",
        json={
            "name": " Vacaciones ",
            "currency": "brl",
            "myParticipantName": "Ana",
            "otherParticipants": ["Leandro"],
        },
        headers=auth_headers(user["_id"]),
    )
    body = response.json()
    doc = await db.accounts.find_one({})
    assert doc["ownerId"] == user["_id"]
    assert doc["name"] == "Vacaciones"
    assert doc["currency"] == "BRL"
    assert doc["icon"] == "group"
    assert len(doc["inviteCode"]) == 22
    owner_participant = next(p for p in doc["participants"] if p["name"] == "Ana")
    assert owner_participant["userId"] == user["_id"]
    assert body["participants"][0]["isOwner"] is True
    assert await actions(db, doc["_id"]) == ["account.created"]
    entry = await db.audit_logs.find_one({"action": "account.created"})
    assert entry["entityType"] == "account"
    assert "inviteCode" not in str(entry)


async def test_my_accounts_lists_only_mine_newest_first(client, db, create_user, create_account):
    me = await create_user()
    other = await create_user(email="other@mail.com")
    older = await create_account(me, name="Older")
    newer = await create_account(me, name="Newer", closed=True)
    await create_account(me, name="Deleted", deleted=True)
    await create_account(other, name="Foreign")
    await db.accounts.update_one(
        {"_id": older["_id"]}, {"$set": {"updatedAt": datetime.now(UTC) - timedelta(days=1)}}
    )
    response = await client.get("/accounts", headers=auth_headers(me["_id"]))
    names = [a["name"] for a in response.json()]
    assert names == ["Newer", "Older"]
    assert response.json()[0]["isClosed"] is True
    assert newer["_id"]


async def test_currency_cannot_change(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, currency="ARS")
    response = await client.patch(
        f"/accounts/{account['_id']}", json={"currency": "USD"}, headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 422
    current = await client.get(f"/accounts/{account['_id']}", headers=auth_headers(owner["_id"]))
    assert current.json()["currency"] == "ARS"
