import pytest

from app.core.errors import AppError
from app.core.security import hash_email
from app.services import rate_limit_service


async def _rewind(db, seconds: int) -> None:
    """Move every recorded attempt back in time."""
    async for doc in db.auth_attempts.find({}):
        from datetime import timedelta

        await db.auth_attempts.update_one(
            {"_id": doc["_id"]},
            {"$set": {"createdAt": doc["createdAt"] - timedelta(seconds=seconds)}},
        )


async def test_one_request_per_minute(db):
    await rate_limit_service.check_and_record_email_request("ana@mail.com", "login")
    with pytest.raises(AppError) as exc:
        await rate_limit_service.check_and_record_email_request("ANA@mail.com ", "login")
    assert exc.value.code == "rate_limited"
    assert 1 <= exc.value.retry_after_seconds <= 60
    # Different purposes are independent.
    await rate_limit_service.check_and_record_email_request("ana@mail.com", "password_reset")


async def test_five_requests_per_hour(db):
    for _ in range(5):
        await rate_limit_service.check_and_record_email_request("ana@mail.com", "register")
        await _rewind(db, 61)
    with pytest.raises(AppError) as exc:
        await rate_limit_service.check_and_record_email_request("ana@mail.com", "register")
    assert exc.value.code == "rate_limited"
    assert exc.value.retry_after_seconds > 60


async def test_limits_apply_to_unknown_emails_and_store_only_hash(db):
    await rate_limit_service.check_and_record_email_request("nobody@mail.com", "login")
    with pytest.raises(AppError):
        await rate_limit_service.check_and_record_email_request("nobody@mail.com", "login")
    doc = await db.auth_attempts.find_one({})
    assert doc["emailHash"] == hash_email("nobody@mail.com")
    assert "nobody" not in str(doc)


async def test_release_forgets_the_request(db):
    attempt = await rate_limit_service.check_and_record_email_request("ana@mail.com", "login")
    await rate_limit_service.release(attempt)
    await rate_limit_service.check_and_record_email_request("ana@mail.com", "login")


async def test_password_lockout_after_ten_failures(db):
    for attempt in range(9):
        assert await rate_limit_service.record_password_failure("ana@mail.com") is False, attempt
    await rate_limit_service.check_password_lockout("ana@mail.com")
    assert await rate_limit_service.record_password_failure("ana@mail.com") is True
    with pytest.raises(AppError) as exc:
        await rate_limit_service.check_password_lockout("ana@mail.com")
    assert exc.value.code == "password_login_locked"
    assert 890 <= exc.value.retry_after_seconds <= 900


async def test_failures_outside_window_do_not_count(db):
    for _ in range(9):
        await rate_limit_service.record_password_failure("ana@mail.com")
    await _rewind(db, 16 * 60)
    assert await rate_limit_service.record_password_failure("ana@mail.com") is False


async def test_clear_password_failures_resets_the_count(db):
    for _ in range(9):
        await rate_limit_service.record_password_failure("ana@mail.com")
    await rate_limit_service.clear_password_failures("ana@mail.com")
    assert await rate_limit_service.record_password_failure("ana@mail.com") is False
