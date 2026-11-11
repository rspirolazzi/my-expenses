"""Expense requests and responses (contracts/api.md). Amounts travel as decimal text."""

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, ConfigDict, Field, field_validator

from app.schemas.account import Description
from app.schemas.common import CamelModel

CategoryIcon = Literal[
    "other",
    "home",
    "car",
    "hotel",
    "beach",
    "food",
    "money",
    "travel",
    "party",
    "shopping",
    "sports",
]

TITLE_MAX = 80
PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 100


def _title(value: str) -> str:
    """1–80 characters after trimming; only spaces is invalid."""
    trimmed = value.strip()
    if not trimmed or len(trimmed) > TITLE_MAX:
        raise ValueError(f"must have 1 to {TITLE_MAX} characters")
    return trimmed


Title = Annotated[str, AfterValidator(_title)]


class ExpenseWrite(CamelModel):
    """Fields shared by create and update; unknown fields (currency, receiptUrl) give 422."""

    model_config = ConfigDict(extra="forbid")

    date: date
    title: Title
    description: Description = None
    amount: str = Field(min_length=1, max_length=32)
    paid_by_id: str = Field(min_length=1)
    participant_ids: list[str] = Field(min_length=1, max_length=50)
    category_icon: CategoryIcon = "other"

    @field_validator("participant_ids")
    @classmethod
    def _unique(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class ExpenseCreate(ExpenseWrite):
    client_request_id: UUID


class ExpenseUpdate(ExpenseWrite):
    version: int = Field(ge=1)


class ParticipantRef(CamelModel):
    id: str
    name: str


class ExpenseListItem(CamelModel):
    id: str
    date: date
    title: str
    category_icon: CategoryIcon
    amount: str
    paid_by: ParticipantRef | None
    is_pending: bool


class ExpensePage(CamelModel):
    items: list[ExpenseListItem]
    next_cursor: str | None
    total: str | None
    count: int | None


class ShareResponse(CamelModel):
    participant: ParticipantRef
    amount: str


class ExpenseResponse(CamelModel):
    id: str
    account_id: str
    date: date
    title: str
    description: str | None
    amount: str
    currency: str
    category_icon: CategoryIcon
    paid_by: ParticipantRef | None
    participants: list[ParticipantRef]
    shares: list[ShareResponse]
    is_pending: bool
    version: int
    created_at: datetime
    updated_at: datetime


HistoryField = Literal[
    "date", "title", "description", "amount", "paidBy", "participants", "categoryIcon"
]
HistoryValue = str | ParticipantRef | list[ParticipantRef] | None


class HistoryChange(CamelModel):
    field: HistoryField
    before: HistoryValue
    after: HistoryValue


class HistoryEntry(CamelModel):
    id: str
    action: Literal["created", "updated", "deleted"]
    actor_name: str | None
    reason: Literal["participant_removed"] | None
    at: datetime
    changes: list[HistoryChange]


class ParticipantImpact(CamelModel):
    affected_expenses: int


class ExpenseConflict(CamelModel):
    """Body of 409 expense_conflict: the error plus the current expense."""

    current: ExpenseResponse
