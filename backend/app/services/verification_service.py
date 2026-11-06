"""One-time 6-digit codes stored as HMAC-SHA256, valid 15 minutes, 5 attempts (R5)."""

import hmac
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core import errors
from app.core.errors import AppError
from app.core.security import generate_code, hash_code
from app.repositories import verification_codes
from app.repositories.auth_attempts import LimitPurpose
from app.repositories.verification_codes import CodePurpose
from app.services import email_service, rate_limit_service
from app.services.email_service import EmailTemplate

CODE_TTL = timedelta(minutes=15)


async def send_limited_email(
    *,
    email: str,
    limit_purpose: LimitPurpose,
    template: EmailTemplate,
    language: str,
    context: dict[str, Any] | None = None,
) -> None:
    """Send an email that counts against the per-email limit; on failure it does not count."""
    attempt_id = await rate_limit_service.check_and_record_email_request(email, limit_purpose)
    try:
        await email_service.send(template, email, language, context)
    except AppError:
        await rate_limit_service.release(attempt_id)
        raise


async def issue_code(
    *,
    email: str,
    purpose: CodePurpose,
    limit_purpose: LimitPurpose,
    template: EmailTemplate,
    language: str,
    user_id: ObjectId | None = None,
    context: dict[str, Any] | None = None,
) -> None:
    attempt_id = await rate_limit_service.check_and_record_email_request(email, limit_purpose)
    await verification_codes.invalidate_active(email, purpose)
    code = generate_code()
    code_id = await verification_codes.insert(
        email=email,
        purpose=purpose,
        code_hash=hash_code(code),
        expires_at=datetime.now(UTC) + CODE_TTL,
        user_id=user_id,
    )
    try:
        await email_service.send(
            template,
            email,
            language,
            {
                **(context or {}),
                "code": code,
                "expiresInMinutes": int(CODE_TTL.total_seconds() // 60),
            },
        )
    except AppError:
        await verification_codes.mark_invalidated(code_id)
        await rate_limit_service.release(attempt_id)
        raise


async def verify_code(
    email: str,
    purpose: CodePurpose,
    code: str,
    session: AsyncClientSession | None = None,
) -> dict[str, Any]:
    """Return the consumed code document, or raise 400 invalid_code."""
    doc = await verification_codes.find_latest_valid(email, purpose)
    if doc is None:
        raise AppError(400, errors.INVALID_CODE)
    if not hmac.compare_digest(doc["codeHash"], hash_code(code)):
        await verification_codes.increment_attempts(doc["_id"])
        raise AppError(400, errors.INVALID_CODE)
    if not await verification_codes.mark_consumed(doc["_id"], session=session):
        raise AppError(400, errors.INVALID_CODE)
    return doc
