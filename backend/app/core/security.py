"""Password hashing, JWT access tokens, one-time codes and opaque refresh tokens."""

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

_password_hash = PasswordHash.recommended()  # Argon2id

# Verified against when the user does not exist, so both paths take the same time (R7).
DUMMY_PASSWORD_HASH = _password_hash.hash("dummy-password-for-timing-only")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hash.verify(password, password_hash)
    except Exception:  # noqa: BLE001 - malformed hashes count as a failed verification
        return False


def verify_and_update_password(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Verify a password and return a new hash when the stored parameters are outdated."""
    try:
        return _password_hash.verify_and_update(password, password_hash)
    except Exception:  # noqa: BLE001
        return False, None


def validate_password(password: str, email: str) -> str | None:
    """Return an error description, or None when the password is acceptable (FR-007)."""
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"must have at least {PASSWORD_MIN_LENGTH} characters"
    if len(password) > PASSWORD_MAX_LENGTH:
        return f"must have at most {PASSWORD_MAX_LENGTH} characters"
    if normalize_email(password) == normalize_email(email):
        return "must not be equal to the email"
    return None


def generate_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def _hmac(value: str, key: str | None) -> str:
    secret = key or get_settings().code_hash_secret
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def hash_code(code: str, key: str | None = None) -> str:
    return _hmac(f"code:{code}", key)


def hash_email(email: str, key: str | None = None) -> str:
    return _hmac(f"email:{normalize_email(email)}", key)


def create_access_token(user_id: str) -> tuple[str, datetime]:
    settings = get_settings()
    issued_at = datetime.now(UTC).replace(microsecond=0)
    expires_at = issued_at + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    """Validate signature, issuer, audience and expiry. Raises jwt.PyJWTError when invalid."""
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={"require": ["sub", "iss", "aud", "iat", "exp", "jti"]},
    )


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
