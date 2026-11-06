"""Registration, sign-in (password, code, Google), password reset and logout."""

import asyncio

from bson import ObjectId

from app.core import errors
from app.core.errors import AppError
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    normalize_email,
    validate_password,
    verify_and_update_password,
    verify_password,
)
from app.db.client import transaction
from app.repositories import pending_registrations, refresh_tokens, users
from app.schemas.auth import AuthResponse, RegisterRequest
from app.schemas.user import NAME_MAX_LENGTH
from app.services import (
    audit_service,
    email_service,
    rate_limit_service,
    token_service,
    verification_service,
)
from app.services.google_service import GoogleVerifier


def _language_of(user: dict) -> str:
    return (user.get("preferences") or {}).get("language", "es")


def _validate_password_or_422(password: str, email: str) -> None:
    if validate_password(password, email) is not None:
        raise AppError(422, errors.VALIDATION_ERROR)


async def _notify(template, to: str, language: str, context: dict | None = None) -> None:
    """Security notices are best effort: the change they describe is already committed."""
    try:
        await email_service.send(template, to, language, context)
    except AppError:
        pass


# --- Email + password registration (US1) -------------------------------------------------------


async def register(request: RegisterRequest) -> None:
    email = normalize_email(request.email)
    _validate_password_or_422(request.password, email)
    # Hash before checking existence so both branches take the same time (R7).
    password_hash = await asyncio.to_thread(hash_password, request.password)

    existing = await users.find_by_email(email)
    if existing is not None:
        await verification_service.send_limited_email(
            email=email,
            limit_purpose="register",
            template="account_exists",
            language=_language_of(existing),
        )
        return

    await pending_registrations.upsert_by_email(
        email=email,
        password_hash=password_hash,
        first_name=request.first_name,
        last_name=request.last_name,
        language=request.language,
    )
    await verification_service.issue_code(
        email=email,
        purpose="verify_email",
        limit_purpose="register",
        template="verify_email",
        language=request.language,
    )


async def resend_registration(email: str) -> None:
    email = normalize_email(email)
    pending = await pending_registrations.find_by_email(email)
    if pending is None:
        await rate_limit_service.check_and_record_email_request(email, "register")
        return
    await verification_service.issue_code(
        email=email,
        purpose="verify_email",
        limit_purpose="register",
        template="verify_email",
        language=pending["language"],
    )


async def verify_registration(email: str, code: str, client: str) -> AuthResponse:
    email = normalize_email(email)
    pending = await pending_registrations.find_by_email(email)
    if pending is None:
        raise AppError(400, errors.INVALID_CODE)

    async with transaction() as session:
        await verification_service.verify_code(email, "verify_email", code, session=session)
        if await users.find_by_email(email, session=session) is not None:
            raise AppError(400, errors.INVALID_CODE)
        document = users.new_user_document(
            email=email,
            first_name=pending.get("firstName"),
            last_name=pending.get("lastName"),
            auth_providers=["email"],
            password_hash=pending["passwordHash"],
            language=pending["language"],
        )
        user_id = await users.insert(document, session=session)
        document["_id"] = user_id
        await pending_registrations.delete_by_email(email, session=session)
        metadata = {"client": client, "method": "password"}
        await audit_service.record(
            "user.registered",
            actor_user_id=user_id,
            entity_id=user_id,
            metadata=metadata,
            session=session,
        )
        await audit_service.record(
            "user.email_verified",
            actor_user_id=user_id,
            entity_id=user_id,
            metadata=metadata,
            session=session,
        )
        tokens = await token_service.issue_token_pair(user_id, client, session=session)
    return AuthResponse(tokens=tokens, user=users.to_user_response(document), is_new_user=True)


# --- Password sign-in (US1) ---------------------------------------------------------------------


async def login_password(email: str, password: str, client: str) -> AuthResponse:
    email = normalize_email(email)
    await rate_limit_service.check_password_lockout(email)

    user = await users.find_by_email(email)
    new_hash: str | None = None
    if user is None or user.get("passwordHash") is None:
        await asyncio.to_thread(verify_password, password, DUMMY_PASSWORD_HASH)
        valid = False
    else:
        valid, new_hash = await asyncio.to_thread(
            verify_and_update_password, password, user["passwordHash"]
        )

    user_id = user["_id"] if user else None
    metadata = {"client": client, "method": "password"}
    if not valid:
        locked = await rate_limit_service.record_password_failure(email)
        await audit_service.record(
            "user.login_failed", actor_user_id=user_id, entity_id=user_id, metadata=metadata
        )
        if locked:
            await audit_service.record(
                "user.login_locked", actor_user_id=user_id, entity_id=user_id, metadata=metadata
            )
            await rate_limit_service.check_password_lockout(email)
        raise AppError(401, errors.INVALID_CREDENTIALS)

    assert user is not None and user_id is not None
    await rate_limit_service.clear_password_failures(email)
    async with transaction() as session:
        if new_hash:
            user = await users.update_fields(user_id, {"passwordHash": new_hash}, session=session)
        await audit_service.record(
            "user.login_succeeded",
            actor_user_id=user_id,
            entity_id=user_id,
            metadata=metadata,
            session=session,
        )
        tokens = await token_service.issue_token_pair(user_id, client, session=session)
    assert user is not None
    return AuthResponse(tokens=tokens, user=users.to_user_response(user), is_new_user=False)


# --- Google (US2) -------------------------------------------------------------------------------


def _google_name(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    return value.strip()[:NAME_MAX_LENGTH]


async def login_with_google(
    id_token: str, client: str, language: str, verifier: GoogleVerifier
) -> AuthResponse:
    claims = await asyncio.to_thread(verifier, id_token)
    if not claims.email_verified:
        raise AppError(403, errors.GOOGLE_EMAIL_NOT_VERIFIED)
    email = normalize_email(claims.email)
    metadata = {"client": client, "method": "google"}

    linked = False
    is_new = False
    async with transaction() as session:
        user = await users.find_by_google_subject(claims.sub, session=session)
        if user is None:
            user = await users.find_by_email(email, session=session)
            if user is not None:
                if user.get("googleSubject") and user["googleSubject"] != claims.sub:
                    # Another Google account is already linked to this user: never reassign it.
                    raise AppError(401, errors.INVALID_GOOGLE_TOKEN)
                user = await users.update_fields(
                    user["_id"],
                    {"googleSubject": claims.sub},
                    session=session,
                    add_to_set={"authProviders": "google"},
                )
                assert user is not None
                await audit_service.record(
                    "user.google_linked",
                    actor_user_id=user["_id"],
                    entity_id=user["_id"],
                    changes={"authProviders": {"after": user["authProviders"]}},
                    metadata=metadata,
                    session=session,
                )
                linked = True
            else:
                user = users.new_user_document(
                    email=email,
                    first_name=_google_name(claims.given_name),
                    last_name=_google_name(claims.family_name),
                    auth_providers=["google"],
                    google_subject=claims.sub,
                    language=language,
                )
                user["_id"] = await users.insert(user, session=session)
                await audit_service.record(
                    "user.registered",
                    actor_user_id=user["_id"],
                    entity_id=user["_id"],
                    metadata=metadata,
                    session=session,
                )
                is_new = True
        await audit_service.record(
            "user.login_succeeded",
            actor_user_id=user["_id"],
            entity_id=user["_id"],
            metadata=metadata,
            session=session,
        )
        tokens = await token_service.issue_token_pair(user["_id"], client, session=session)

    if linked:
        await _notify("security_google_linked", user["email"], _language_of(user))
    return AuthResponse(tokens=tokens, user=users.to_user_response(user), is_new_user=is_new)


# --- One-time login code (US3) ------------------------------------------------------------------


async def request_login_code(email: str) -> None:
    email = normalize_email(email)
    user = await users.find_by_email(email)
    if user is None:
        await rate_limit_service.check_and_record_email_request(email, "login")
        return
    await verification_service.issue_code(
        email=email,
        purpose="login",
        limit_purpose="login",
        template="login_code",
        language=_language_of(user),
        user_id=user["_id"],
    )


async def verify_login_code(email: str, code: str, client: str) -> AuthResponse:
    email = normalize_email(email)
    user = await users.find_by_email(email)
    if user is None:
        raise AppError(400, errors.INVALID_CODE)
    async with transaction() as session:
        await verification_service.verify_code(email, "login", code, session=session)
        await audit_service.record(
            "user.login_succeeded",
            actor_user_id=user["_id"],
            entity_id=user["_id"],
            metadata={"client": client, "method": "code"},
            session=session,
        )
        tokens = await token_service.issue_token_pair(user["_id"], client, session=session)
    return AuthResponse(tokens=tokens, user=users.to_user_response(user), is_new_user=False)


# --- Password reset / first password (US4) ------------------------------------------------------


async def request_password_reset(email: str) -> None:
    email = normalize_email(email)
    user = await users.find_by_email(email)
    if user is None:
        await rate_limit_service.check_and_record_email_request(email, "password_reset")
        return
    await verification_service.issue_code(
        email=email,
        purpose="password_reset",
        limit_purpose="password_reset",
        template="password_reset",
        language=_language_of(user),
        user_id=user["_id"],
    )


async def confirm_password_reset(
    email: str, code: str, new_password: str, client: str
) -> AuthResponse:
    email = normalize_email(email)
    _validate_password_or_422(new_password, email)
    user = await users.find_by_email(email)
    if user is None:
        raise AppError(400, errors.INVALID_CODE)

    new_hash = await asyncio.to_thread(hash_password, new_password)
    had_password = user.get("passwordHash") is not None
    user_id: ObjectId = user["_id"]
    async with transaction() as session:
        await verification_service.verify_code(email, "password_reset", code, session=session)
        updated = await users.update_fields(
            user_id,
            {"passwordHash": new_hash},
            session=session,
            add_to_set={"authProviders": "email"},
        )
        # Every previous session ends (FR-006); the new pair below starts a fresh family.
        await refresh_tokens.revoke_all_for_user(user_id, session=session)
        await audit_service.record(
            "user.password_reset" if had_password else "user.password_set",
            actor_user_id=user_id,
            entity_id=user_id,
            changes={} if had_password else {"authProviders": {"after": updated["authProviders"]}},
            metadata={"client": client, "method": "code"},
            session=session,
        )
        tokens = await token_service.issue_token_pair(user_id, client, session=session)

    await rate_limit_service.clear_password_failures(email)
    await _notify("security_password_changed", email, _language_of(user))
    assert updated is not None
    return AuthResponse(tokens=tokens, user=users.to_user_response(updated), is_new_user=False)


# --- Logout (US6) -------------------------------------------------------------------------------


async def logout(refresh_token: str, client: str) -> None:
    """Idempotent: an unknown or already revoked token is not an error."""
    from app.core.security import hash_refresh_token

    doc = await refresh_tokens.revoke_by_hash(hash_refresh_token(refresh_token))
    if doc is not None:
        await audit_service.record(
            "user.logged_out",
            actor_user_id=doc["userId"],
            entity_id=doc["userId"],
            metadata={"client": client},
        )
