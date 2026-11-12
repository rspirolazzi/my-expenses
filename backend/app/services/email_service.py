"""Transactional emails rendered with Jinja2 and sent with Resend (R10).

With EMAIL_DELIVERY=console nothing is sent: each email is appended as one JSON line to the dev
outbox file (never to the application log). Tests set `capture` to collect emails in memory.
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import resend
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.core import errors
from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

EmailTemplate = Literal[
    "verify_email",
    "account_exists",
    "login_code",
    "password_reset",
    "change_email",
    "security_google_linked",
    "security_password_changed",
    "security_email_changed",
]

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates" / "emails"

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
    undefined=StrictUndefined,
)


@dataclass
class SentEmail:
    to: str
    template: str
    language: str
    subject: str
    context: dict[str, Any] = field(default_factory=dict)


# Set to a list by the test suite to capture emails instead of writing the outbox file.
capture: list[SentEmail] | None = None


def render(template: EmailTemplate, language: str, context: dict[str, Any]) -> tuple[str, str]:
    tpl = _env.get_template(f"{language}/{template}.html")
    module = tpl.make_module(context)
    subject = str(getattr(module, "subject", "ChePagame")).strip()
    return subject, str(module)


def _write_dev_outbox(email: SentEmail) -> None:
    path = Path(get_settings().email_dev_outbox_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps({**asdict(email), "sentAt": datetime.now(UTC).isoformat()})
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


async def _deliver(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    resend.api_key = settings.resend_api_key
    params: resend.Emails.SendParams = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    await asyncio.to_thread(resend.Emails.send, params)


async def send(
    template: EmailTemplate, to: str, language: str, context: dict[str, Any] | None = None
) -> None:
    context = context or {}
    subject, html = render(template, language, context)
    email = SentEmail(to=to, template=template, language=language, subject=subject, context=context)

    if get_settings().email_delivery == "console":
        if capture is not None:
            capture.append(email)
        else:
            _write_dev_outbox(email)
        return

    try:
        await _deliver(to, subject, html)
    except Exception as exc:  # noqa: BLE001 - any provider failure is a retryable 503
        # Only the template name is logged: no recipient, code or token (Principle VI).
        logger.warning("Email delivery failed for template %s: %s", template, type(exc).__name__)
        raise AppError(503, errors.EMAIL_UNAVAILABLE) from exc
