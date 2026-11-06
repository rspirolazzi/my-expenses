from datetime import UTC, datetime

from tests.conftest import actions, auth_headers, last_code


async def test_request_stores_pending_email_and_sends_code(client, db, create_user, email_outbox):
    user = await create_user(email="ana@mail.com")
    response = await client.post(
        "/users/me/email-change",
        json={"newEmail": "New@Mail.com"},
        headers=auth_headers(user["_id"]),
    )
    assert response.status_code == 202
    stored = await db.users.find_one({"_id": user["_id"]})
    assert stored["pendingEmail"] == "new@mail.com"
    assert email_outbox[-1].to == "new@mail.com"
    assert email_outbox[-1].template == "change_email"
    assert "user.email_change_requested" in await actions(db, user["_id"])


async def test_taken_email_sends_nothing_and_reveals_nothing(client, db, create_user, email_outbox):
    user = await create_user(email="ana@mail.com")
    await create_user(email="taken@mail.com")
    await client.post(
        "/users/me/email-change",
        json={"newEmail": "taken@mail.com"},
        headers=auth_headers(user["_id"]),
    )
    assert email_outbox == []
    assert (await db.users.find_one({"_id": user["_id"]}))["pendingEmail"] is None


async def test_confirm_replaces_email_and_notifies_the_old_address(
    client, db, create_user, email_outbox
):
    user = await create_user(email="ana@mail.com", language="en")
    headers = auth_headers(user["_id"])
    await client.post("/users/me/email-change", json={"newEmail": "new@mail.com"}, headers=headers)
    code = last_code(email_outbox, "new@mail.com")
    await client.post("/users/me/email-change/confirm", json={"code": code}, headers=headers)

    stored = await db.users.find_one({"_id": user["_id"]})
    assert (stored["email"], stored["pendingEmail"]) == ("new@mail.com", None)
    entry = await db.audit_logs.find_one({"action": "user.email_changed"})
    assert entry["changes"]["email"] == {"before": "ana@mail.com", "after": "new@mail.com"}
    notice = email_outbox[-1]
    assert (notice.to, notice.template, notice.language) == (
        "ana@mail.com",
        "security_email_changed",
        "en",
    )


async def test_confirm_fails_if_someone_took_the_email_meanwhile(
    client, db, create_user, email_outbox
):
    user = await create_user(email="ana@mail.com")
    headers = auth_headers(user["_id"])
    await client.post("/users/me/email-change", json={"newEmail": "new@mail.com"}, headers=headers)
    code = last_code(email_outbox, "new@mail.com")
    await db.users.insert_one(
        {
            "email": "new@mail.com",
            "authProviders": ["email"],
            "createdAt": datetime.now(UTC),
            "updatedAt": datetime.now(UTC),
        }
    )
    response = await client.post(
        "/users/me/email-change/confirm", json={"code": code}, headers=headers
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"
    assert (await db.users.find_one({"_id": user["_id"]}))["email"] == "ana@mail.com"
