from tests.conftest import actions, auth_headers, link, participant_id


async def test_a_closed_account_is_read_only(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    await client.post(f"/accounts/{account['_id']}/close", headers=auth_headers(owner["_id"]))

    base = f"/accounts/{account['_id']}"
    javier = participant_id(account, "Javier")
    owner_headers = auth_headers(owner["_id"])
    attempts = [
        await client.patch(base, json={"name": "X"}, headers=owner_headers),
        await client.post(f"{base}/participants", json={"name": "X"}, headers=owner_headers),
        await client.patch(
            f"{base}/participants/{javier}", json={"name": "X"}, headers=owner_headers
        ),
        await client.delete(f"{base}/participants/{javier}", headers=owner_headers),
        await client.post(f"{base}/leave", headers=auth_headers(member["_id"])),
        await client.post(f"{base}/invite-code", headers=owner_headers),
    ]
    assert {(r.status_code, r.json()["error"]["code"]) for r in attempts} == {
        (409, "account_closed")
    }
    invite = await client.post(
        f"/invitations/{account['inviteCode']}/accept",
        json={"participantId": javier},
        headers=auth_headers(guest["_id"]),
    )
    assert (invite.status_code, invite.json()["error"]["code"]) == (404, "invalid_invitation")

    # Reading still works for every member, and there is no way to reopen it.
    assert (await client.get(base, headers=auth_headers(member["_id"]))).status_code == 200
    reopen = await client.post(f"{base}/reopen", headers=owner_headers)
    assert reopen.status_code in (404, 405)
    assert "account.closed" in await actions(db, account["_id"])


async def test_delete_hides_the_account_for_everyone(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)

    response = await client.delete(
        f"/accounts/{account['_id']}", headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 204

    doc = await db.accounts.find_one({"_id": account["_id"]})
    assert doc["isDeleted"] is True and doc["deletedAt"] is not None
    assert "account.deleted" in await actions(db, account["_id"])
    for user in (owner, member):
        headers = auth_headers(user["_id"])
        assert (await client.get(f"/accounts/{account['_id']}", headers=headers)).status_code == 404
        assert (await client.get("/accounts", headers=headers)).json() == []
    invite = await client.get(
        f"/invitations/{account['inviteCode']}", headers=auth_headers(guest["_id"])
    )
    assert invite.status_code == 404
