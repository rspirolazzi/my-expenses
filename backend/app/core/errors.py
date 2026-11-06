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
)


class AppError(Exception):
    def __init__(self, status_code: int, code: str, retry_after_seconds: int | None = None):
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.retry_after_seconds = retry_after_seconds
