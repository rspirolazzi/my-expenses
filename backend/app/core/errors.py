"""Application errors, rendered as `{ error: { code, message, retryAfterSeconds? } }`."""

VALIDATION_ERROR = "validation_error"
RATE_LIMITED = "rate_limited"
EMAIL_UNAVAILABLE = "email_unavailable"
INVALID_CODE = "invalid_code"
INVALID_CREDENTIALS = "invalid_credentials"
PASSWORD_LOGIN_LOCKED = "password_login_locked"
INVALID_GOOGLE_TOKEN = "invalid_google_token"
GOOGLE_EMAIL_NOT_VERIFIED = "google_email_not_verified"
INVALID_REFRESH_TOKEN = "invalid_refresh_token"
UNAUTHORIZED = "unauthorized"
EMAIL_TAKEN = "email_taken"
NOT_FOUND = "not_found"
INTERNAL_ERROR = "internal_error"
ACCOUNT_CLOSED = "account_closed"
OWNER_ONLY = "owner_only"
OWNER_CANNOT_LEAVE = "owner_cannot_leave"
OWNER_PARTICIPANT = "owner_participant"
DUPLICATE_PARTICIPANT_NAME = "duplicate_participant_name"
INVALID_INVITATION = "invalid_invitation"
ALREADY_MEMBER = "already_member"
PARTICIPANT_TAKEN = "participant_taken"
EXPENSE_CONFLICT = "expense_conflict"
INVALID_PARTICIPANT = "invalid_participant"

ERROR_CODES = (
    VALIDATION_ERROR,
    RATE_LIMITED,
    EMAIL_UNAVAILABLE,
    INVALID_CODE,
    INVALID_CREDENTIALS,
    PASSWORD_LOGIN_LOCKED,
    INVALID_GOOGLE_TOKEN,
    GOOGLE_EMAIL_NOT_VERIFIED,
    INVALID_REFRESH_TOKEN,
    UNAUTHORIZED,
    EMAIL_TAKEN,
    NOT_FOUND,
    INTERNAL_ERROR,
    ACCOUNT_CLOSED,
    OWNER_ONLY,
    OWNER_CANNOT_LEAVE,
    OWNER_PARTICIPANT,
    DUPLICATE_PARTICIPANT_NAME,
    INVALID_INVITATION,
    ALREADY_MEMBER,
    PARTICIPANT_TAKEN,
    EXPENSE_CONFLICT,
    INVALID_PARTICIPANT,
)


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        retry_after_seconds: int | None = None,
        extra: dict | None = None,
    ):
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.retry_after_seconds = retry_after_seconds
        # Extra top-level fields next to `error`, e.g. `current` for expense_conflict.
        self.extra = extra
