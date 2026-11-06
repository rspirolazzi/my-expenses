from typing import get_args

import pytest

from app.services.email_service import TEMPLATES_DIR, EmailTemplate, render

TEMPLATES = get_args(EmailTemplate)
CONTEXT = {"code": "123456", "expiresInMinutes": 15, "newEmail": "new@mail.com"}


@pytest.mark.parametrize("language", ["es", "en"])
@pytest.mark.parametrize("template", TEMPLATES)
def test_every_template_exists_in_both_languages(template, language):
    assert (TEMPLATES_DIR / language / f"{template}.html").is_file()
    subject, html = render(template, language, CONTEXT)
    assert subject and subject != "Mis Gastos"
    assert f'lang="{language}"' in html


@pytest.mark.parametrize("template", TEMPLATES)
def test_only_code_templates_include_the_code(template):
    _, html = render(template, "es", CONTEXT)
    expects_code = template in {"verify_email", "login_code", "password_reset", "change_email"}
    assert ("123456" in html) is expects_code


def test_templates_never_reference_secrets():
    for path in TEMPLATES_DIR.rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        for forbidden in ("password", "passwordHash", "token", "codeHash"):
            assert "{{ " + forbidden not in text, path
