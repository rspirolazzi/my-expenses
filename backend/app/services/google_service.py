"""Google ID token verification for Web (Auth.js) and Mobile (native Google Sign-In) (R3)."""

from collections.abc import Callable

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel

from app.core import errors
from app.core.config import get_settings
from app.core.errors import AppError


class GoogleClaims(BaseModel):
    sub: str
    email: str
    email_verified: bool = False
    given_name: str | None = None
    family_name: str | None = None


GoogleVerifier = Callable[[str], GoogleClaims]

_transport = google_requests.Request()


def verify_google_id_token(token: str) -> GoogleClaims:
    """Verify signature, issuer and expiry with Google's library; audience must be one of ours."""
    allowed = get_settings().google_client_ids
    if not allowed:
        raise AppError(401, errors.INVALID_GOOGLE_TOKEN)
    try:
        payload = google_id_token.verify_oauth2_token(token, _transport, audience=None)
    except ValueError as exc:
        raise AppError(401, errors.INVALID_GOOGLE_TOKEN) from exc
    if payload.get("aud") not in allowed or not payload.get("email"):
        raise AppError(401, errors.INVALID_GOOGLE_TOKEN)
    return GoogleClaims.model_validate(payload)


def get_google_verifier() -> GoogleVerifier:
    """FastAPI dependency, overridden in tests with a fake verifier."""
    return verify_google_id_token
