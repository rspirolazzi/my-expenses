"""Balances and settlements requests and responses (contracts/api.md).

Amounts travel as decimal text with exactly the currency's decimals.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import CamelModel
from app.schemas.expense import ParticipantRef

SettlementSource = Literal["suggestion", "manual"]


class SettlementCreate(CamelModel):
    """Unknown fields (currency included) give 422; the currency is always the account's."""

    model_config = ConfigDict(extra="forbid")

    from_participant_id: str = Field(min_length=1)
    to_participant_id: str = Field(min_length=1)
    amount: str = Field(min_length=1, max_length=32)
    date: date
    client_request_id: UUID
    source: SettlementSource = "manual"

    @model_validator(mode="after")
    def _different_sides(self) -> "SettlementCreate":
        if self.from_participant_id == self.to_participant_id:
            raise ValueError("the payer and the receiver must be different participants")
        return self


class SettlementResponse(CamelModel):
    id: str
    account_id: str
    date: date
    from_: ParticipantRef = Field(alias="from")
    to: ParticipantRef
    amount: str
    currency: str
    is_excluded: bool
    created_at: datetime


class SettlementPage(CamelModel):
    items: list[SettlementResponse]
    next_cursor: str | None


class BalanceEntry(CamelModel):
    participant: ParticipantRef
    amount: str
    is_me: bool


class SuggestedTransfer(CamelModel):
    from_: ParticipantRef = Field(alias="from")
    to: ParticipantRef
    amount: str


class AccountBalances(CamelModel):
    currency: str
    currency_decimals: int
    balances: list[BalanceEntry]
    suggestions: list[SuggestedTransfer]
    pending_expenses: int
