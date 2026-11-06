"""Email-request limits and password lockout, applied whether or not the email exists (R6)."""

import math
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core import errors
from app.core.errors import AppError
from app.core.security import hash_email
from app.repositories import auth_attempts
from app.repositories.auth_attempts import LimitPurpose

EMAIL_REQUESTS_PER_MINUTE = 1
EMAIL_REQUESTS_PER_HOUR = 5
PASSWORD_FAILURES_BEFORE_LOCK = 10
PASSWORD_FAILURE_WINDOW = timedelta(minutes=15)
PASSWORD_LOCK_DURATION = timedelta(minutes=15)


def _seconds_until(moment: datetime, now: datetime) -> int:
    return max(1, math.ceil((moment - now).total_seconds()))


async def check_and_record_email_request(email: str, purpose: LimitPurpose) -> ObjectId:
    """Raise 429 if over 1 per minute or 5 per hour; otherwise record the request."""
    email_hash = hash_email(email)
    now = datetime.now(UTC)

    for window, limit in (
        (timedelta(minutes=1), EMAIL_REQUESTS_PER_MINUTE),
        (timedelta(hours=1), EMAIL_REQUESTS_PER_HOUR),
    ):
        since = now - window
        if await auth_attempts.count_since(email_hash, "email_request", purpose, since) >= limit:
            oldest = await auth_attempts.oldest_since(email_hash, "email_request", purpose, since)
            retry_at = (oldest["createdAt"] if oldest else now) + window
            raise AppError(429, errors.RATE_LIMITED, _seconds_until(retry_at, now))

    return await auth_attempts.insert(email_hash, "email_request", purpose)


async def release(attempt_id: ObjectId) -> None:
    """Forget a recorded request (used when the email could not be sent)."""
    await auth_attempts.delete_by_id(attempt_id)


async def check_password_lockout(email: str) -> None:
    now = datetime.now(UTC)
    lock = await auth_attempts.latest(
        hash_email(email), "password_lockout", now - PASSWORD_LOCK_DURATION
    )
    if lock:
        retry_at = lock["createdAt"] + PASSWORD_LOCK_DURATION
        raise AppError(423, errors.PASSWORD_LOGIN_LOCKED, _seconds_until(retry_at, now))


async def record_password_failure(email: str) -> bool:
    """Record a failed password login; returns True if this failure triggered a lockout."""
    email_hash = hash_email(email)
    await auth_attempts.insert(email_hash, "password_failure")
    since = datetime.now(UTC) - PASSWORD_FAILURE_WINDOW
    failures = await auth_attempts.count_since(email_hash, "password_failure", None, since)
    if failures >= PASSWORD_FAILURES_BEFORE_LOCK:
        await auth_attempts.insert(email_hash, "password_lockout")
        await auth_attempts.delete_failures(email_hash)
        return True
    return False


async def clear_password_failures(email: str) -> None:
    await auth_attempts.delete_failures(hash_email(email))
