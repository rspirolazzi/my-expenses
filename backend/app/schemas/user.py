from datetime import datetime
from typing import Annotated, Literal

import pycountry
from pydantic import AfterValidator, EmailStr, Field, field_validator

from app.schemas.common import CamelModel

LanguageCode = Literal["es", "en"]
ThemeName = Literal["light", "dark", "system"]
AuthProvider = Literal["google", "email"]

NAME_MAX_LENGTH = 60


def _currency_code(value: str | None) -> str | None:
    if value is None:
        return None
    code = value.strip().upper()
    if len(code) != 3 or pycountry.currencies.get(alpha_3=code) is None:
        raise ValueError("must be an ISO 4217 currency code")
    return code


def _optional_name(value: str | None) -> str | None:
    """Trim a first/last name; empty becomes null; 1-60 characters after trimming (FR-016)."""
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > NAME_MAX_LENGTH:
        raise ValueError(f"must have at most {NAME_MAX_LENGTH} characters")
    return trimmed


CurrencyCode = Annotated[str | None, AfterValidator(_currency_code)]
PersonName = Annotated[str | None, AfterValidator(_optional_name)]


class Preferences(CamelModel):
    language: LanguageCode = "es"
    default_currency: str | None = None
    theme: ThemeName = "system"


class UserResponse(CamelModel):
    id: str
    email: str
    first_name: str | None
    last_name: str | None
    auth_providers: list[AuthProvider]
    has_password_set: bool
    pending_email: str | None
    preferences: Preferences
    created_at: datetime
    updated_at: datetime


class PreferencesUpdate(CamelModel):
    language: LanguageCode | None = None
    default_currency: CurrencyCode = None
    theme: ThemeName | None = None


class UpdateMeRequest(CamelModel):
    """Partial update: only fields present in the request body are applied."""

    first_name: PersonName = None
    last_name: PersonName = None
    preferences: PreferencesUpdate | None = None


class EmailChangeRequest(CamelModel):
    new_email: EmailStr


class EmailChangeConfirmRequest(CamelModel):
    code: str = Field(pattern=r"^\d{6}$")

    @field_validator("code", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
