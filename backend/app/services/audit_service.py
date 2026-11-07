from typing import Any, Literal

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.repositories import audit_logs

AuditAction = Literal[
    "user.registered",
    "user.email_verified",
    "user.login_succeeded",
    "user.login_failed",
    "user.login_locked",
    "user.google_linked",
    "user.password_set",
    "user.password_reset",
    "user.email_change_requested",
    "user.email_changed",
    "user.profile_updated",
    "user.logged_out",
    "account.created",
    "account.updated",
    "account.participant_added",
    "account.participant_renamed",
    "account.participant_removed",
    "account.member_joined",
    "account.member_left",
    "account.invite_regenerated",
    "account.closed",
    "account.deleted",
]

# Never stored in audit entries (FR-014, Principle VI).
SENSITIVE_KEYS = frozenset(
    {
        "password",
        "newPassword",
        "passwordHash",
        "code",
        "codeHash",
        "token",
        "tokenHash",
        "refreshToken",
        "accessToken",
        "idToken",
        "inviteCode",
    }
)


def _scrub(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items() if k not in SENSITIVE_KEYS}
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    return value


async def record(
    action: AuditAction,
    *,
    actor_user_id: ObjectId | None,
    entity_id: ObjectId | None,
    changes: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
    session: AsyncClientSession | None = None,
    entity_type: str = "user",
) -> None:
    await audit_logs.insert(
        action=action,
        entity_type=entity_type,
        actor_user_id=actor_user_id,
        entity_id=entity_id,
        changes=_scrub(changes or {}),
        metadata=_scrub(metadata or {}),
        session=session,
    )
