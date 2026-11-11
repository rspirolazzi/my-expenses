import asyncio

from tests.conftest import actions, auth_headers, link, participant_id


async def test_a_member_edits_and_the_owner_sees_it(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    headers = auth_headers(member["_id"])

    await client.patch(f"/accounts/{account['_id']}", json={"name": "Brasil"}, headers=headers)
    await client.post(
        f"/accounts/{account['_id']}/participants", json={"name": "Martina"}, headers=headers
    )
    await client.delete(
        f"/accounts/{account['_id']}/participants/{participant_id(account, 'Javier')}",
        headers=headers,
    )
    seen = (
        await client.get(f"/accounts/{account['_id']}", headers=auth_headers(owner["_id"]))
    ).json()
    assert seen["name"] == "Brasil"
    assert [p["name"] for p in seen["participants"]] == ["Ana", "Leandro", "Martina"]

    entry = await db.audit_logs.find_one({"action": "account.updated"})
    assert entry["changes"]["name"] == {"before": "Viaje", "after": "Brasil"}
    assert entry["actorUserId"] == member["_id"]


async def test_rename_and_remove_are_audited_and_logical(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    javier = participant_id(account, "Javier")
    base = f"/accounts/{account['_id']}/participants/{javier}"

    await client.patch(base, json={"name": "Javi"}, headers=headers)
    await client.delete(base, headers=headers)

    doc = await db.accounts.find_one({"_id": account["_id"]})
    removed = next(p for p in doc["participants"] if p["id"] == javier)
    assert removed["removedAt"] is not None and removed["name"] == "Javi"
    log = await actions(db, account["_id"])
    assert "account.participant_renamed" in log and "account.participant_removed" in log
    renamed = await db.audit_logs.find_one({"action": "account.participant_renamed"})
    assert list(renamed["changes"].values())[0] == {"before": "Javier", "after": "Javi"}

    # A removed participant's name can be used again.
    reused = await client.post(
        f"/accounts/{account['_id']}/participants", json={"name": "Javi"}, headers=headers
    )
    assert reused.status_code == 201


async def test_removing_a_linked_participant_removes_the_member(
    client, db, create_user, create_account
):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    leandro = await link(db, account, "Leandro", member)
    await client.delete(
        f"/accounts/{account['_id']}/participants/{leandro}", headers=auth_headers(owner["_id"])
    )
    headers = auth_headers(member["_id"])
    assert (await client.get(f"/accounts/{account['_id']}", headers=headers)).status_code == 404
    assert (await client.get("/accounts", headers=headers)).json() == []


async def test_participant_limit_when_adding(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, others=tuple(f"P{i}" for i in range(49)))
    response = await client.post(
        f"/accounts/{account['_id']}/participants",
        json={"name": "One too many"},
        headers=auth_headers(owner["_id"]),
    )
    assert (response.status_code, response.json()["error"]["code"]) == (422, "validation_error")


async def test_concurrent_edits_keep_both_changes(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    url = f"/accounts/{account['_id']}"
    await asyncio.gather(
        client.patch(url, json={"name": "Brasil"}, headers=auth_headers(owner["_id"])),
        client.patch(url, json={"icon": "beach"}, headers=auth_headers(member["_id"])),
    )
    doc = await db.accounts.find_one({"_id": account["_id"]})
    assert (doc["name"], doc["icon"]) == ("Brasil", "beach")
    assert await db.audit_logs.count_documents({"action": "account.updated"}) == 2


async def test_new_account_audit_entries_carry_the_account_id(
    client, db, create_user, create_account
):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.patch(
        f"/accounts/{account['_id']}", json={"name": "Brasil"}, headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    entry = await db.audit_logs.find_one({"action": "account.updated"})
    assert entry["accountId"] == account["_id"]
    assert entry["entityId"] == account["_id"]
