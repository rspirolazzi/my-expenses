import pytest

from tests.conftest import auth_headers, link

PREVIEW_FIELDS = {
    "accountName",
    "icon",
    "currency",
    "alreadyMember",
    "accountId",
    "availableParticipants",
}


async def test_preview(client, db, create_user, create_account):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    linked = await create_user(email="linked@mail.com")
    account = await create_account(owner)
    await link(db, account, "Javier", linked)

    response = await client.get(
        f"/invitations/{account['inviteCode']}", headers=auth_headers(guest["_id"])
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body) == PREVIEW_FIELDS
    assert [p["name"] for p in body["availableParticipants"]] == ["Leandro"]
    assert body["alreadyMember"] is False and body["accountId"] is None


@pytest.mark.parametrize("state", ["unknown", "closed", "deleted"])
async def test_invalid_invitations_look_the_same(client, create_user, create_account, state):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner, closed=state == "closed", deleted=state == "deleted")
    code = "x" * 22 if state == "unknown" else account["inviteCode"]
    response = await client.get(f"/invitations/{code}", headers=auth_headers(guest["_id"]))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "invalid_invitation"


async def test_preview_requires_a_session(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.get(f"/invitations/{account['inviteCode']}")
    assert response.status_code == 401


async def test_accept_with_participant_or_new_name(client, create_user, create_account):
    owner = await create_user()
    first = await create_user(email="first@mail.com")
    second = await create_user(email="second@mail.com")
    account = await create_account(owner)
    code = account["inviteCode"]
    leandro = next(p["id"] for p in account["participants"] if p["name"] == "Leandro")

    linked = await client.post(
        f"/invitations/{code}/accept",
        json={"participantId": leandro},
        headers=auth_headers(first["_id"]),
    )
    assert linked.status_code == 200
    assert linked.json()["myParticipantId"] == leandro

    added = await client.post(
        f"/invitations/{code}/accept",
        json={"newParticipantName": "Martina"},
        headers=auth_headers(second["_id"]),
    )
    assert added.status_code == 200
    assert any(p["name"] == "Martina" and p["isMe"] for p in added.json()["participants"])


@pytest.mark.parametrize("body", [{}, {"participantId": "a", "newParticipantName": "b"}])
async def test_accept_requires_exactly_one_option(client, create_user, create_account, body):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    account = await create_account(owner)
    response = await client.post(
        f"/invitations/{account['inviteCode']}/accept",
        json=body,
        headers=auth_headers(guest["_id"]),
    )
    assert response.status_code == 422


async def test_accept_errors(client, db, create_user, create_account):
    owner = await create_user()
    guest = await create_user(email="guest@mail.com")
    other = await create_user(email="other@mail.com")
    account = await create_account(owner)
    code = account["inviteCode"]
    javier = await link(db, account, "Javier", other)
    headers = auth_headers(guest["_id"])

    taken = await client.post(
        f"/invitations/{code}/accept", json={"participantId": javier}, headers=headers
    )
    assert (taken.status_code, taken.json()["error"]["code"]) == (409, "participant_taken")

    duplicate = await client.post(
        f"/invitations/{code}/accept", json={"newParticipantName": " leandro"}, headers=headers
    )
    assert (duplicate.status_code, duplicate.json()["error"]["code"]) == (
        422,
        "duplicate_participant_name",
    )

    member = await client.post(
        f"/invitations/{code}/accept",
        json={"newParticipantName": "Someone"},
        headers=auth_headers(owner["_id"]),
    )
    assert (member.status_code, member.json()["error"]["code"]) == (409, "already_member")


async def test_regenerate_invite_code(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)

    forbidden = await client.post(
        f"/accounts/{account['_id']}/invite-code", headers=auth_headers(member["_id"])
    )
    assert (forbidden.status_code, forbidden.json()["error"]["code"]) == (403, "owner_only")

    response = await client.post(
        f"/accounts/{account['_id']}/invite-code", headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    assert response.json()["inviteCode"] != account["inviteCode"]
