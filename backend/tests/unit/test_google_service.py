import pytest

from app.core.config import get_settings
from app.core.errors import AppError
from app.services import google_service


@pytest.fixture
def allowed_ids(monkeypatch):
    monkeypatch.setattr(get_settings(), "google_client_ids", ["web-id", "android-id"])


def _payload(aud="web-id"):
    return {"sub": "g-1", "email": "ana@gmail.com", "email_verified": True, "aud": aud}


def test_accepts_tokens_for_our_client_ids(monkeypatch, allowed_ids):
    calls = []

    def fake_verify(token, request, audience=None):
        calls.append(token)
        return _payload("android-id")

    monkeypatch.setattr(google_service.google_id_token, "verify_oauth2_token", fake_verify)
    claims = google_service.verify_google_id_token("id-token")
    assert claims.sub == "g-1" and claims.email_verified
    assert calls == ["id-token"]


def test_rejects_tokens_the_library_rejects(monkeypatch, allowed_ids):
    def fake_verify(*_args, **_kwargs):
        raise ValueError("bad signature")

    monkeypatch.setattr(google_service.google_id_token, "verify_oauth2_token", fake_verify)
    with pytest.raises(AppError) as exc:
        google_service.verify_google_id_token("id-token")
    assert exc.value.code == "invalid_google_token"


def test_rejects_other_audiences(monkeypatch, allowed_ids):
    monkeypatch.setattr(
        google_service.google_id_token,
        "verify_oauth2_token",
        lambda *_a, **_k: _payload("someone-else"),
    )
    with pytest.raises(AppError):
        google_service.verify_google_id_token("id-token")
