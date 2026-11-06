"""FR-014 / Principle VI: no passwords, codes, tokens or emails leak into audit logs or app logs."""

import logging

from tests.conftest import auth_headers, last_code

PASSWORD = "very-secret-password"
NEW_PASSWORD = "another-secret-password"


async def test_flows_leave_no_sensitive_data(
    client, db, email_outbox, fake_google_verifier, caplog
):
    caplog.set_level(logging.INFO)  # app and uvicorn logs; driver DEBUG logs are off
    secrets: set[str] = {PASSWORD, NEW_PASSWORD}

    # US1: register, verify, login.
    await client.post("/auth/register", json={"email": "ana@mail.com", "password": PASSWORD})
    code = last_code(email_outbox, "ana@mail.com")
    secrets.add(code)
    verified = (
        await client.post("/auth/register/verify", json={"email": "ana@mail.com", "code": code})
    ).json()
    secrets.add(verified["tokens"]["refreshToken"])
    await client.post("/auth/login", json={"email": "ana@mail.com", "password": "wrong-password"})
    login = (
        await client.post("/auth/login", json={"email": "ana@mail.com", "password": PASSWORD})
    ).json()
    secrets.add(login["tokens"]["refreshToken"])
    user_id = login["user"]["id"]

    # US2: Google link.
    token = fake_google_verifier.add("g", sub="g-1", email="ana@mail.com", email_verified=True)
    await client.post("/auth/google", json={"idToken": token})

    # US3: code login.
    await client.post("/auth/login-code", json={"email": "ana@mail.com"})
    code = last_code(email_outbox, "ana@mail.com")
    secrets.add(code)
    await client.post("/auth/login-code/verify", json={"email": "ana@mail.com", "code": code})

    # US4: password reset.
    await client.post("/auth/password-reset", json={"email": "ana@mail.com"})
    code = last_code(email_outbox, "ana@mail.com")
    secrets.add(code)
    reset = await client.post(
        "/auth/password-reset/confirm",
        json={"email": "ana@mail.com", "code": code, "newPassword": NEW_PASSWORD},
    )
    secrets.add(reset.json()["tokens"]["refreshToken"])

    # US5: profile and email change.
    headers = auth_headers(user_id)
    await client.patch("/users/me", json={"firstName": "Ana"}, headers=headers)
    await client.post("/users/me/email-change", json={"newEmail": "new@mail.com"}, headers=headers)
    code = last_code(email_outbox, "new@mail.com")
    secrets.add(code)
    await client.post("/users/me/email-change/confirm", json={"code": code}, headers=headers)

    # US6: logout; attempts against an unknown email.
    await client.post("/auth/logout", json={"refreshToken": reset.json()["tokens"]["refreshToken"]})
    await client.post("/auth/login-code", json={"email": "stranger@mail.com"})

    audit_dump = str([doc async for doc in db.audit_logs.find({})])
    for secret in secrets:
        assert secret not in audit_dump
        assert secret not in caplog.text

    for email in ("ana@mail.com", "new@mail.com", "stranger@mail.com"):
        assert email not in caplog.text

    attempts_dump = str([doc async for doc in db.auth_attempts.find({})])
    assert "@" not in attempts_dump
