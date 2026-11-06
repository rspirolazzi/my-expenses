from app.services import token_service
from tests.conftest import actions, last_code


async def _reset(client, email_outbox, email="ana@mail.com", new_password="brand-new-password"):
    await client.post("/auth/password-reset", json={"email": email})
    code = last_code(email_outbox, email)
    return await client.post(
        "/auth/password-reset/confirm",
        json={"email": email, "code": code, "newPassword": new_password},
    )


async def test_reset_changes_password_and_closes_other_sessions(
    client, db, create_user, email_outbox
):
    user = await create_user(email="ana@mail.com", language="en")
    old_session = await token_service.issue_token_pair(user["_id"], "mobile")
    for _ in range(3):
        await client.post("/auth/login", json={"email": "ana@mail.com", "password": "wrong"})

    response = await _reset(client, email_outbox)
    assert response.status_code == 200

    old_login = await client.post(
        "/auth/login", json={"email": "ana@mail.com", "password": "correct-password"}
    )
    assert old_login.status_code == 401
    new_login = await client.post(
        "/auth/login", json={"email": "ana@mail.com", "password": "brand-new-password"}
    )
    assert new_login.status_code == 200

    refreshed_old = await client.post(
        "/auth/refresh", json={"refreshToken": old_session.refresh_token}
    )
    assert refreshed_old.status_code == 401
    new_tokens = response.json()["tokens"]
    refreshed_new = await client.post(
        "/auth/refresh", json={"refreshToken": new_tokens["refreshToken"]}
    )
    assert refreshed_new.status_code == 200

    assert "user.password_reset" in await actions(db, user["_id"])
    notices = [(e.template, e.language) for e in email_outbox if e.template.startswith("security")]
    assert notices == [("security_password_changed", "en")]


async def test_google_only_user_sets_a_first_password(client, db, create_user, email_outbox):
    user = await create_user(email="ana@gmail.com", password=None, google_subject="g-1")
    response = await _reset(client, email_outbox, email="ana@gmail.com")
    assert response.status_code == 200
    assert sorted(response.json()["user"]["authProviders"]) == ["email", "google"]
    assert response.json()["user"]["hasPasswordSet"] is True
    assert "user.password_set" in await actions(db, user["_id"])
