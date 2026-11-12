from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# The repository root holds the single .env file shared by every service.
_REPO_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    """Application settings read from the environment or the repository .env file."""

    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT_ENV, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"

    mongodb_uri: str
    mongodb_host_override: str | None = None
    mongodb_db_name: str = "chepagame"
    mongodb_test_db_name: str = "chepagame_test"

    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_issuer: str = "chepagame-api"
    jwt_audience: str = "chepagame-clients"
    refresh_token_expire_days: int = 30

    code_hash_secret: str = Field(min_length=32)
    google_client_ids: Annotated[list[str], NoDecode] = []

    resend_api_key: str = ""
    email_from: str = ""
    email_delivery: Literal["resend", "console"] = "resend"
    email_dev_outbox_path: str = ".dev-outbox/emails.jsonl"

    @field_validator("google_client_ids", mode="before")
    @classmethod
    def _split_client_ids(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _check_email_delivery(self) -> "Settings":
        if self.environment == "production" and self.email_delivery == "console":
            raise ValueError("EMAIL_DELIVERY=console is not allowed when ENVIRONMENT=production")
        if self.email_delivery == "resend" and not (self.resend_api_key and self.email_from):
            raise ValueError(
                "RESEND_API_KEY and EMAIL_FROM are required when EMAIL_DELIVERY=resend"
            )
        return self

    @property
    def mongodb_connection_uri(self) -> str:
        """MONGODB_URI, with its host replaced by MONGODB_HOST_OVERRIDE (used inside Docker)."""
        if not self.mongodb_host_override:
            return self.mongodb_uri
        scheme, rest = self.mongodb_uri.split("://", 1)
        credentials, _, after_at = rest.rpartition("@")
        _, sep, tail = after_at.partition("/")
        prefix = f"{credentials}@" if credentials else ""
        return f"{scheme}://{prefix}{self.mongodb_host_override}{sep}{tail}"

    @property
    def database_name(self) -> str:
        return self.mongodb_test_db_name if self.environment == "test" else self.mongodb_db_name


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
