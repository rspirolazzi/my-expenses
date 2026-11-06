from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.core.security import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH
from app.schemas.common import CamelModel
from app.schemas.user import LanguageCode, PersonName, UserResponse

CODE_PATTERN = r"^\d{6}$"


class _CodeMixin(CamelModel):
    code: str = Field(pattern=CODE_PATTERN)

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TokenPair(CamelModel):
    access_token: str
    access_token_expires_at: datetime
    refresh_token: str
    refresh_token_expires_at: datetime


class AuthResponse(CamelModel):
    tokens: TokenPair
    user: UserResponse
    is_new_user: bool


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=1, max_length=512)


class LogoutRequest(CamelModel):
    refresh_token: str = Field(min_length=1, max_length=512)


class RegisterRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    first_name: PersonName = None
    last_name: PersonName = None
    language: LanguageCode = "es"


class EmailRequest(CamelModel):
    email: EmailStr


class ResendRegistrationRequest(EmailRequest):
    pass


class LoginCodeRequest(EmailRequest):
    pass


class PasswordResetRequest(EmailRequest):
    pass


class VerifyCodeRequest(_CodeMixin):
    email: EmailStr


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class GoogleLoginRequest(CamelModel):
    id_token: str = Field(min_length=1, max_length=8192)


class PasswordResetConfirmRequest(_CodeMixin):
    email: EmailStr
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
