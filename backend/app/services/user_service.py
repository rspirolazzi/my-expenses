from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core import errors
from app.core.errors import AppError
from app.core.security import normalize_email
from app.db.client import transaction
from app.repositories import users
from app.schemas.user import EmailChangeRequest, UpdateMeRequest, UserResponse
from app.services import audit_service, email_service, rate_limit_service, verification_service


async def get_me(user_id: ObjectId) -> UserResponse:
    doc = await users.find_by_id(user_id)
    if doc is None:
        raise AppError(401, errors.UNAUTHORIZED)
    return users.to_user_response(doc)


async def update_me(user_id: ObjectId, request: UpdateMeRequest, client: str) -> UserResponse:
    """Apply only the fields present in the request; record before/after in one transaction."""
    sent = request.model_fields_set
    fields: dict[str, Any] = {}
    if "first_name" in sent:
        fields["firstName"] = request.first_name
    if "last_name" in sent:
        fields["lastName"] = request.last_name
    if request.preferences is not None:
        prefs = request.preferences
        prefs_sent = prefs.model_fields_set
        for attr, key in (
            ("language", "language"),
            ("default_currency", "defaultCurrency"),
            ("theme", "theme"),
        ):
            value = getattr(prefs, attr)
            # Preferences cannot be cleared: a null value means "unchanged".
            if attr in prefs_sent and value is not None:
                fields[f"preferences.{key}"] = value

    async with transaction() as session:
        current = await users.find_by_id(user_id, session=session)
        if current is None:
            raise AppError(401, errors.UNAUTHORIZED)

        changes: dict[str, dict[str, Any]] = {}
        for path, after in fields.items():
            before: Any = current
            for part in path.split("."):
                before = before.get(part) if isinstance(before, dict) else None
            if before != after:
                changes[path] = {"before": before, "after": after}

        if not changes:
            return users.to_user_response(current)

        updated = await users.update_fields(
            user_id, {path: change["after"] for path, change in changes.items()}, session=session
        )
        await audit_service.record(
            "user.profile_updated",
            actor_user_id=user_id,
            entity_id=user_id,
            changes=changes,
            metadata={"client": client},
            session=session,
        )
    assert updated is not None
    return users.to_user_response(updated)


async def request_email_change(user_id: ObjectId, request: EmailChangeRequest, client: str) -> None:
    current = await users.find_by_id(user_id)
    if current is None:
        raise AppError(401, errors.UNAUTHORIZED)
    new_email = normalize_email(request.new_email)
    if new_email == current["email"]:
        raise AppError(422, errors.VALIDATION_ERROR)

    language = current["preferences"].get("language", "es")
    if await users.find_by_email(new_email) is not None:
        # Do not reveal that the email belongs to someone else (FR-008): only apply the limit.
        await rate_limit_service.check_and_record_email_request(new_email, "change_email")
        return

    await verification_service.issue_code(
        email=new_email,
        purpose="change_email",
        limit_purpose="change_email",
        template="change_email",
        language=language,
        user_id=user_id,
    )
    async with transaction() as session:
        await users.update_fields(user_id, {"pendingEmail": new_email}, session=session)
        await audit_service.record(
            "user.email_change_requested",
            actor_user_id=user_id,
            entity_id=user_id,
            changes={"pendingEmail": {"before": current.get("pendingEmail"), "after": new_email}},
            metadata={"client": client},
            session=session,
        )


async def confirm_email_change(user_id: ObjectId, code: str, client: str) -> UserResponse:
    current = await users.find_by_id(user_id)
    if current is None:
        raise AppError(401, errors.UNAUTHORIZED)
    new_email = current.get("pendingEmail")
    if not new_email:
        raise AppError(400, errors.INVALID_CODE)

    old_email = current["email"]
    try:
        async with transaction() as session:
            await verification_service.verify_code(new_email, "change_email", code, session=session)
            if await users.find_by_email(new_email, session=session) is not None:
                raise AppError(409, errors.EMAIL_TAKEN)
            updated = await users.update_fields(
                user_id, {"email": new_email, "pendingEmail": None}, session=session
            )
            await audit_service.record(
                "user.email_changed",
                actor_user_id=user_id,
                entity_id=user_id,
                changes={"email": {"before": old_email, "after": new_email}},
                metadata={"client": client},
                session=session,
            )
    except DuplicateKeyError as exc:
        raise AppError(409, errors.EMAIL_TAKEN) from exc

    language = current["preferences"].get("language", "es")
    try:
        await email_service.send(
            "security_email_changed", old_email, language, {"newEmail": new_email}
        )
    except AppError:
        pass  # The change is already committed; the notice is best effort.
    assert updated is not None
    return users.to_user_response(updated)
