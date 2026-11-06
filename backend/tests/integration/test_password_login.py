from datetime import UTC, datetime, timedelta

from app.core import security
from tests.conftest import actions


async def _login(client, email="ana@mail.com", password="correct-password"):
    return await client.post("/auth/login", json={"email": email, "password": password})


async def test_success_returns_tokens_and_is_audited(client, db, create_user):
    user = await create_user()
    response = await _login(client)
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "ana@mail.com"
    assert "user.login_succeeded" in await actions(db, user["_id"])


async def test_failure_is_audited(client, db, create_user):
    user = await create_user()
    assert (await _login(client, password="wrong")).status_code == 401
    assert await actions(db, user["_id"]) == ["user.login_failed"]


async def test_ten_failures_lock_password_login(client, db, create_user):
    user = await create_user()
    for _ in range(9):
        assert (await _login(client, password="wrong")).status_code == 401
    locked = await _login(client, password="wrong")
    assert locked.status_code == 423
    # Even the right password is rejected while locked.
    assert (await _login(client)).status_code == 423
    assert "user.login_locked" in await actions(db, user["_id"])


async def test_success_before_the_tenth_failure_resets_the_count(client, create_user):
    await create_user()
    for _ in range(9):
        await _login(client, password="wrong")
    assert (await _login(client)).status_code == 200
    for _ in range(9):
        assert (await _login(client, password="wrong")).status_code == 401


async def test_failures_outside_the_window_reset_it(client, db, create_user):
    await create_user()
    for _ in range(9):
        await _login(client, password="wrong")
    await db.auth_attempts.update_many(
        {}, {"$set": {"createdAt": datetime.now(UTC) - timedelta(minutes=16)}}
    )
    assert (await _login(client, password="wrong")).status_code == 401


async def test_unknown_email_behaves_like_an_existing_one(client, monkeypatch):
    calls = []
    original = security.verify_password

    def spy(password, password_hash):
        calls.append(password_hash)
        return original(password, password_hash)

    monkeypatch.setattr("app.services.auth_service.verify_password", spy)
    for _ in range(9):
        assert (await _login(client, email="nobody@mail.com")).status_code == 401
    assert (await _login(client, email="nobody@mail.com")).status_code == 423
    assert calls and all(h == security.DUMMY_PASSWORD_HASH for h in calls)
