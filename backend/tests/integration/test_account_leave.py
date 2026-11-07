from tests.conftest import actions, auth_headers, link


async def test_a_member_leaves_and_the_participant_stays(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    leandro = await link(db, account, "Leandro", member)
    headers = auth_headers(member["_id"])

    response = await client.post(f"/accounts/{account['_id']}/leave", headers=headers)
    assert response.status_code == 204
    doc = await db.accounts.find_one({"_id": account["_id"]})
    participant = next(p for p in doc["participants"] if p["id"] == leandro)
    assert participant["userId"] is None and participant["removedAt"] is None
    assert "account.member_left" in await actions(db, account["_id"])
    assert (await client.get(f"/accounts/{account['_id']}", headers=headers)).status_code == 404
    assert (await client.get("/accounts", headers=headers)).json() == []

    # The owner still sees the participant, now free; the member can join again.
    seen = (
        await client.get(f"/accounts/{account['_id']}", headers=auth_headers(owner["_id"]))
    ).json()
    assert any(p["name"] == "Leandro" and not p["isLinked"] for p in seen["participants"])
    rejoin = await client.post(
        f"/invitations/{account['inviteCode']}/accept",
        json={"participantId": leandro},
        headers=headers,
    )
    assert rejoin.status_code == 200


async def test_the_owner_cannot_leave(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.post(
        f"/accounts/{account['_id']}/leave", headers=auth_headers(owner["_id"])
    )
    assert (response.status_code, response.json()["error"]["code"]) == (403, "owner_cannot_leave")


async def test_cannot_leave_a_closed_account(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner, closed=True)
    await link(db, account, "Leandro", member)
    response = await client.post(
        f"/accounts/{account['_id']}/leave", headers=auth_headers(member["_id"])
    )
    assert (response.status_code, response.json()["error"]["code"]) == (409, "account_closed")
