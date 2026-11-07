from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, ConfigDict, Field, model_validator

from app.schemas.common import CamelModel
from app.schemas.user import _currency_code

AccountIcon = Literal[
    "group",
    "home",
    "car",
    "hotel",
    "beach",
    "food",
    "money",
    "travel",
    "party",
    "shopping",
    "work",
    "sports",
]

ACCOUNT_NAME_MAX = 80
DESCRIPTION_MAX = 500
PARTICIPANT_NAME_MAX = 40
MAX_PARTICIPANTS = 50


def _account_name(value: str) -> str:
    """1–80 characters without counting leading/trailing spaces."""
    trimmed = value.strip()
    if not trimmed or len(trimmed) > ACCOUNT_NAME_MAX:
        raise ValueError(f"must have 1 to {ACCOUNT_NAME_MAX} characters")
    return trimmed


def _description(value: str | None) -> str | None:
    """Up to 500 characters; empty becomes null."""
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > DESCRIPTION_MAX:
        raise ValueError(f"must have at most {DESCRIPTION_MAX} characters")
    return trimmed


def _participant_name(value: str) -> str:
    """1–40 characters, trimmed."""
    trimmed = value.strip()
    if not trimmed or len(trimmed) > PARTICIPANT_NAME_MAX:
        raise ValueError(f"must have 1 to {PARTICIPANT_NAME_MAX} characters")
    return trimmed


def _required_currency(value: str) -> str:
    """ISO 4217 code, required (Principle III)."""
    code = _currency_code(value)
    if code is None:
        raise ValueError("currency is required")
    return code


AccountName = Annotated[str, AfterValidator(_account_name)]
RequiredCurrency = Annotated[str, AfterValidator(_required_currency)]
Description = Annotated[str | None, AfterValidator(_description)]
ParticipantNameStr = Annotated[str, AfterValidator(_participant_name)]


def name_key(name: str) -> str:
    """Uniqueness key for participant names: trimmed and case-insensitive."""
    return name.strip().lower()


class AccountCreate(CamelModel):
    name: AccountName
    description: Description = None
    icon: AccountIcon = "group"
    currency: RequiredCurrency
    my_participant_name: ParticipantNameStr
    other_participants: list[ParticipantNameStr] = Field(default_factory=list)

    @model_validator(mode="after")
    def _limit(self) -> "AccountCreate":
        if 1 + len(self.other_participants) > MAX_PARTICIPANTS:
            raise ValueError(f"at most {MAX_PARTICIPANTS} participants")
        return self


class AccountUpdate(CamelModel):
    """Partial update; unknown fields (currency included) are rejected with 422."""

    model_config = ConfigDict(extra="forbid")

    name: AccountName | None = None
    description: Description = None
    icon: AccountIcon | None = None


class ParticipantName(CamelModel):
    name: ParticipantNameStr


class AcceptInvitation(CamelModel):
    participant_id: str | None = None
    new_participant_name: ParticipantNameStr | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> "AcceptInvitation":
        if (self.participant_id is None) == (self.new_participant_name is None):
            raise ValueError("send exactly one of participantId or newParticipantName")
        return self


class ParticipantResponse(CamelModel):
    id: str
    name: str
    is_linked: bool
    is_me: bool
    is_owner: bool


class AccountSummary(CamelModel):
    id: str
    name: str
    icon: AccountIcon
    currency: str
    is_closed: bool
    is_owner: bool
    participant_count: int
    updated_at: datetime


class AccountResponse(CamelModel):
    id: str
    name: str
    description: str | None
    icon: AccountIcon
    currency: str
    is_closed: bool
    closed_at: datetime | None
    is_owner: bool
    my_participant_id: str
    participants: list[ParticipantResponse]
    invite_code: str
    created_at: datetime
    updated_at: datetime


class AvailableParticipant(CamelModel):
    id: str
    name: str


class InvitationPreview(CamelModel):
    account_name: str
    icon: AccountIcon
    currency: str
    already_member: bool
    account_id: str | None
    available_participants: list[AvailableParticipant]
