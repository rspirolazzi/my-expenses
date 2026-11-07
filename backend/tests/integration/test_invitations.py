import asyncio

from tests.conftest import actions, auth_headers, participant_id


async def test_linking_makes_the_user_a_member(client, db, create_user, create_account):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com", first_name="Leo")
    account = await create_account(owner)
    leandro = participant_id(account, "Leandro")

    await client.post(
        f"/invitations/{account['inviteCode']}/accept",
        json={"participantId": leandro},
        headers=auth_headers(guest["_id"]),
    )
    doc = await db.accounts.find_one({"_id": account["_id"]})
    participant = next(p for p in doc["participants"] if p["id"] == leandro)
    assert participant["userId"] == guest["_id"] and participant["linkedAt"] is not None
    assert "account.member_joined" in await actions(db, account["_id"])

    mine = await client.get("/accounts", headers=auth_headers(guest["_id"]))
    assert [a["id"] for a in mine.json()] == [str(account["_id"])]
    # The rest of the group still sees the participant name, not the profile name.
    seen = await client.get(f"/accounts/{account['_id']}", headers=auth_headers(owner["_id"]))
    names = [p["name"] for p in seen.json()["participants"]]
    assert "Leandro" in names and "Leo" not in names

    again = await client.get(
        f"/invitations/{account['inviteCode']}", headers=auth_headers(guest["_id"])
    )
    assert again.json()["alreadyMember"] is True
    assert again.json()["accountId"] == str(account["_id"])


async def test_a_member_cannot_link_to_a_second_participant(client, create_user, create_account):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner)
    code = account["inviteCode"]
    headers = auth_headers(guest["_id"])
    await client.post(
        f"/invitations/{code}/accept",
        json={"participantId": participant_id(account, "Leandro")},
        headers=headers,
    )
    second = await client.post(
        f"/invitations/{code}/accept",
        json={"participantId": participant_id(account, "Javier")},
        headers=headers,
    )
    assert second.json()["error"]["code"] == "already_member"


async def test_concurrent_acceptance_links_only_one_user(client, db, create_user, create_account):
    owner = await create_user()
    first = await create_user(email="first@mail.com")
    second = await create_user(email="second@mail.com")
    account = await create_account(owner)
    javier = participant_id(account, "Javier")

    async def accept(user):
        return await client.post(
            f"/invitations/{account['inviteCode']}/accept",
            json={"participantId": javier},
            headers=auth_headers(user["_id"]),
        )

    results = await asyncio.gather(accept(first), accept(second))
    assert sorted(r.status_code for r in results) == [200, 409]
    doc = await db.accounts.find_one({"_id": account["_id"]})
    linked = [p for p in doc["participants"] if p["id"] == javier]
    assert linked[0]["userId"] in (first["_id"], second["_id"])


async def test_regenerated_code_stops_working(client, db, create_user, create_account):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner)
    old = account["inviteCode"]
    await client.post(f"/accounts/{account['_id']}/invite-code", headers=auth_headers(owner["_id"]))
    response = await client.get(f"/invitations/{old}", headers=auth_headers(guest["_id"]))
    assert response.status_code == 404
    entry = await db.audit_logs.find_one({"action": "account.invite_regenerated"})
    assert entry and old not in str(entry)


async def test_joining_as_new_participant_respects_the_limit(client, create_user, create_account):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner, others=tuple(f"P{i}" for i in range(49)))
    response = await client.post(
        f"/invitations/{account['inviteCode']}/accept",
        json={"newParticipantName": "One too many"},
        headers=auth_headers(guest["_id"]),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
