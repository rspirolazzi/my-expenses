from typing import Literal

from app.core import errors

Language = Literal["es", "en"]
SUPPORTED_LANGUAGES: tuple[Language, ...] = ("es", "en")
DEFAULT_LANGUAGE: Language = "es"


def resolve_language(accept_language: str | None) -> Language:
    """Pick the first supported language from an Accept-Language header (default: es)."""
    if not accept_language:
        return DEFAULT_LANGUAGE
    candidates: list[tuple[float, str]] = []
    for index, part in enumerate(accept_language.split(",")):
        pieces = part.strip().split(";")
        tag = pieces[0].strip().lower()
        quality = 1.0
        for param in pieces[1:]:
            if param.strip().startswith("q="):
                try:
                    quality = float(param.strip()[2:])
                except ValueError:
                    quality = 0.0
        candidates.append((quality - index * 1e-6, tag))
    for _, tag in sorted(candidates, reverse=True):
        primary = tag.split("-")[0]
        if primary in SUPPORTED_LANGUAGES:
            return primary  # type: ignore[return-value]
    return DEFAULT_LANGUAGE


ERROR_MESSAGES: dict[str, dict[Language, str]] = {
    errors.VALIDATION_ERROR: {
        "es": "Los datos enviados no son válidos.",
        "en": "The submitted data is not valid.",
    },
    errors.RATE_LIMITED: {
        "es": "Demasiados pedidos. Probá de nuevo en unos minutos.",
        "en": "Too many requests. Try again in a few minutes.",
    },
    errors.EMAIL_UNAVAILABLE: {
        "es": "No pudimos enviar el email. Probá de nuevo.",
        "en": "We could not send the email. Please try again.",
    },
    errors.INVALID_CODE: {
        "es": "El código es incorrecto o venció. Pedí uno nuevo.",
        "en": "The code is wrong or has expired. Request a new one.",
    },
    errors.INVALID_CREDENTIALS: {
        "es": "El email o la contraseña no son correctos.",
        "en": "The email or password is not correct.",
    },
    errors.PASSWORD_LOGIN_LOCKED: {
        "es": "Demasiados intentos. El inicio con contraseña está bloqueado por unos minutos.",
        "en": "Too many attempts. Password sign-in is locked for a few minutes.",
    },
    errors.INVALID_GOOGLE_TOKEN: {
        "es": "No pudimos validar tu cuenta de Google.",
        "en": "We could not validate your Google account.",
    },
    errors.GOOGLE_EMAIL_NOT_VERIFIED: {
        "es": "Google no confirmó tu email. Entrá con tu contraseña o con un código.",
        "en": "Google did not confirm your email. Sign in with your password or a code.",
    },
    errors.INVALID_REFRESH_TOKEN: {
        "es": "Tu sesión venció. Volvé a iniciar sesión.",
        "en": "Your session has expired. Please sign in again.",
    },
    errors.UNAUTHORIZED: {
        "es": "Tenés que iniciar sesión.",
        "en": "You need to sign in.",
    },
    errors.EMAIL_TAKEN: {
        "es": "Ese email ya no está disponible.",
        "en": "That email is no longer available.",
    },
    errors.NOT_FOUND: {
        "es": "No encontrado.",
        "en": "Not found.",
    },
    errors.INTERNAL_ERROR: {
        "es": "Ocurrió un error inesperado.",
        "en": "An unexpected error occurred.",
    },
}


def error_message(code: str, language: Language) -> str:
    messages = ERROR_MESSAGES.get(code) or ERROR_MESSAGES[errors.INTERNAL_ERROR]
    return messages[language]
