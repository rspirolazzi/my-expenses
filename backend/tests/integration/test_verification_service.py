from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import AppError
from app.services import verification_service
from tests.conftest import last_code


async def _issue(email="ana@mail.com"):
    await verification_service.issue_code(
        email=email,
        purpose="login",
        limit_purpose="login",
        template="login_code",
        language="es",
    )


async def _allow_next_request(db):
    await db.auth_attempts.delete_many({})


async def test_issue_stores_only_the_hash(db, email_outbox):
    await _issue()
    code = last_code(email_outbox, "ana@mail.com")
    doc = await db.verification_codes.find_one({})
    assert doc["codeHash"] != code and code not in str(doc)
    assert doc["expiresAt"] - doc["createdAt"] == timedelta(minutes=15)


async def test_second_request_within_a_minute_is_rate_limited(db):
    await _issue()
    with pytest.raises(AppError) as exc:
        await _issue()
    assert exc.value.code == "rate_limited"


async def test_new_code_invalidates_the_previous_one(db, email_outbox):
    await _issue()
    first = last_code(email_outbox, "ana@mail.com")
    await _allow_next_request(db)
    await _issue()
    second = last_code(email_outbox, "ana@mail.com")
    if first != second:
        with pytest.raises(AppError):
            await verification_service.verify_code("ana@mail.com", "login", first)
    await verification_service.verify_code("ana@mail.com", "login", second)


async def test_code_can_be_used_once(db, email_outbox):
    await _issue()
    code = last_code(email_outbox, "ana@mail.com")
    await verification_service.verify_code("ana@mail.com", "login", code)
    with pytest.raises(AppError) as exc:
        await verification_service.verify_code("ana@mail.com", "login", code)
    assert exc.value.code == "invalid_code"


async def test_expired_code_is_rejected(db, email_outbox):
    await _issue()
    code = last_code(email_outbox, "ana@mail.com")
    await db.verification_codes.update_many(
        {}, {"$set": {"expiresAt": datetime.now(UTC) - timedelta(seconds=1)}}
    )
    with pytest.raises(AppError):
        await verification_service.verify_code("ana@mail.com", "login", code)


async def test_five_wrong_attempts_invalidate_the_code(db, email_outbox):
    await _issue()
    code = last_code(email_outbox, "ana@mail.com")
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(AppError):
            await verification_service.verify_code("ana@mail.com", "login", wrong)
    assert (await db.verification_codes.find_one({}))["attempts"] == 5
    with pytest.raises(AppError):
        await verification_service.verify_code("ana@mail.com", "login", code)


async def test_send_failure_invalidates_code_and_does_not_count(db, failing_email):
    with pytest.raises(AppError) as exc:
        await _issue()
    assert exc.value.status_code == 503
    doc = await db.verification_codes.find_one({})
    assert doc["invalidatedAt"] is not None
    assert await db.auth_attempts.count_documents({}) == 0
