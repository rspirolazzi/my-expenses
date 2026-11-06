import base64
import time
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.config import get_settings


def test_normalize_email_trims_and_lowercases():
    assert security.normalize_email(" Ana@Mail.com ") == "ana@mail.com"


def test_password_hash_roundtrip():
    hashed = security.hash_password("correct horse battery")
    assert hashed.startswith("$argon2id$")
    assert security.verify_password("correct horse battery", hashed)
    assert not security.verify_password("wrong password", hashed)


@pytest.mark.parametrize(
    ("password", "email", "valid"),
    [
        ("1234567", "ana@mail.com", False),
        ("12345678", "ana@mail.com", True),
        ("x" * 128, "ana@mail.com", True),
        ("x" * 129, "ana@mail.com", False),
        ("Ana@Mail.com", "ana@mail.com", False),
    ],
)
def test_validate_password(password, email, valid):
    assert (security.validate_password(password, email) is None) is valid


def test_generate_code_is_six_digits():
    codes = {security.generate_code() for _ in range(50)}
    assert all(len(code) == 6 and code.isdigit() for code in codes)
    assert len(codes) > 1


def test_hash_code_is_deterministic_and_keyed():
    assert security.hash_code("123456") == security.hash_code("123456")
    assert security.hash_code("123456", key="another-key-another-key-another-key") != (
        security.hash_code("123456")
    )


def test_hash_email_normalizes_and_is_keyed():
    assert security.hash_email("Ana@Mail.com ") == security.hash_email("ana@mail.com")
    assert "ana" not in security.hash_email("ana@mail.com")
    assert security.hash_email("ana@mail.com", key="another-key-another-key-another-key") != (
        security.hash_email("ana@mail.com")
    )


def test_access_token_claims_and_expiry():
    settings = get_settings()
    token, expires_at = security.create_access_token("user-1")
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
    )
    assert payload["sub"] == "user-1"
    assert {"iss", "aud", "iat", "exp", "jti"} <= payload.keys()
    assert payload["exp"] - payload["iat"] == 15 * 60
    assert abs(expires_at - (datetime.now(UTC) + timedelta(minutes=15))) < timedelta(seconds=5)
    assert security.decode_access_token(token)["sub"] == "user-1"


def _token(**overrides):
    settings = get_settings()
    now = int(time.time())
    claims = {
        "sub": "user-1",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": now + 60,
        "jti": "x",
    }
    claims.update(overrides)
    key = claims.pop("_key", settings.jwt_secret)
    return jwt.encode(claims, key, algorithm=settings.jwt_algorithm)


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "someone-else"},
        {"iss": "someone-else"},
        {"exp": int(time.time()) - 10},
        {"_key": "a-different-secret-a-different-secret"},
    ],
)
def test_decode_rejects_invalid_tokens(overrides):
    with pytest.raises(jwt.PyJWTError):
        security.decode_access_token(_token(**overrides))


def test_refresh_token_generation_and_hash():
    token = security.generate_refresh_token()
    raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    assert len(raw) == 32
    digest = security.hash_refresh_token(token)
    assert len(digest) == 64
    assert digest == security.hash_refresh_token(token)
