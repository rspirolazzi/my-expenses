"""What an export contains (feature 005, research R4 and R9). Pure functions, no I/O.

The rows are built once and rendered as CSV or JSON, so both formats always carry the same data.
Only allowed fields are copied: never user ids, owner ids, invite codes, request ids or emails of
other users (FR-013). Shares, balances and suggestions come from the same functions the app uses,
so exported numbers always match what members see (SC-001).
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from bson import ObjectId

from app.core.export_labels import category_label
from app.core.i18n import Language
from app.core.money import currency_decimals, format_amount, split_equal
from app.services.balance_math import compute_balances, is_pending, suggest_transfers


@dataclass(frozen=True)
class Ref:
    id: str
    name: str


@dataclass(frozen=True)
class ParticipantRow:
    id: str
    name: str
    is_removed: bool


@dataclass(frozen=True)
class ShareRow:
    participant: Ref
    amount: str


@dataclass(frozen=True)
class ExpenseRow:
    id: str
    date: str
    title: str
    description: str | None
    category: str
    category_label: str
    amount: str
    currency: str
    paid_by: Ref | None
    is_pending: bool
    shares: tuple[ShareRow, ...]


@dataclass(frozen=True)
class SettlementRow:
    id: str
    date: str
    from_: Ref
    to: Ref
    amount: str
    currency: str
    is_excluded: bool


@dataclass(frozen=True)
class BalanceRow:
    participant: Ref
    amount: str
    currency: str


@dataclass(frozen=True)
class SuggestionRow:
    from_: Ref
    to: Ref
    amount: str
    currency: str


@dataclass(frozen=True)
class AccountExport:
    id: str
    name: str
    description: str | None
    currency: str
    currency_decimals: int
    is_closed: bool
    closed_at: datetime | None
    pending_expenses: int
    participants: tuple[ParticipantRow, ...]
    expenses: tuple[ExpenseRow, ...]
    settlements: tuple[SettlementRow, ...]
    balances: tuple[BalanceRow, ...]
    suggestions: tuple[SuggestionRow, ...]


@dataclass(frozen=True)
class ProfileExport:
    first_name: str | None
    last_name: str | None
    email: str
    language: str
    default_currency: str | None
    theme: str


@dataclass(frozen=True)
class PersonalExport:
    profile: ProfileExport
    accounts: tuple[AccountExport, ...]


def build_account_export(
    account: dict[str, Any],
    expenses: Iterable[dict[str, Any]],
    settlements: Iterable[dict[str, Any]],
    language: Language,
) -> AccountExport:
    """One account at one moment. `expenses` and `settlements` come already in listing order."""
    expenses = list(expenses)
    settlements = list(settlements)
    currency = account["currency"]
    order = [p["id"] for p in account["participants"]]
    names = {p["id"]: p["name"] for p in account["participants"]}
    active = {p["id"] for p in account["participants"] if p.get("removedAt") is None}

    def ref(participant_id: str) -> Ref:
        return Ref(id=participant_id, name=names.get(participant_id, ""))

    def money(minor: int) -> str:
        return format_amount(minor, currency)

    expense_rows = tuple(
        ExpenseRow(
            id=str(doc["_id"]),
            date=doc["date"],
            title=doc["title"],
            description=doc.get("description"),
            category=doc.get("categoryIcon", "other"),
            category_label=category_label(doc.get("categoryIcon", "other"), language),
            amount=money(doc["amountMinor"]),
            currency=currency,
            paid_by=ref(doc["paidById"]) if doc.get("paidById") else None,
            is_pending=is_pending(doc),
            shares=tuple(
                ShareRow(participant=ref(pid), amount=money(amount))
                for pid, amount in split_equal(
                    doc["amountMinor"], doc.get("participantIds") or [], order
                ).items()
            ),
        )
        for doc in expenses
    )
    settlement_rows = tuple(
        SettlementRow(
            id=str(doc["_id"]),
            date=doc["date"],
            from_=ref(doc["fromParticipantId"]),
            to=ref(doc["toParticipantId"]),
            amount=money(doc["amountMinor"]),
            currency=currency,
            is_excluded=doc["fromParticipantId"] not in active
            or doc["toParticipantId"] not in active,
        )
        for doc in settlements
    )
    result = compute_balances(account, expenses, settlements)
    return AccountExport(
        id=str(account["_id"]),
        name=account["name"],
        description=account.get("description"),
        currency=currency,
        currency_decimals=currency_decimals(currency),
        is_closed=bool(account.get("isClosed")),
        closed_at=account.get("closedAt"),
        pending_expenses=result.pending,
        participants=tuple(
            ParticipantRow(id=p["id"], name=p["name"], is_removed=p.get("removedAt") is not None)
            for p in account["participants"]
        ),
        expenses=expense_rows,
        settlements=settlement_rows,
        balances=tuple(
            BalanceRow(participant=ref(pid), amount=money(amount), currency=currency)
            for pid, amount in result.balances.items()
        ),
        suggestions=tuple(
            SuggestionRow(
                from_=ref(t.from_id),
                to=ref(t.to_id),
                amount=money(t.amount_minor),
                currency=currency,
            )
            for t in suggest_transfers(result.balances, order)
        ),
    )


def build_personal_export(
    user: dict[str, Any],
    accounts: Iterable[dict[str, Any]],
    expenses_by_account: Mapping[ObjectId, list[dict[str, Any]]],
    settlements_by_account: Mapping[ObjectId, list[dict[str, Any]]],
    language: Language,
) -> PersonalExport:
    """The user's profile plus every account they are a member of, sorted by name (US2)."""
    preferences = user.get("preferences") or {}
    ordered = sorted(accounts, key=lambda doc: (doc["name"].casefold(), str(doc["_id"])))
    return PersonalExport(
        profile=ProfileExport(
            first_name=user.get("firstName"),
            last_name=user.get("lastName"),
            email=user["email"],
            language=preferences.get("language", "es"),
            default_currency=preferences.get("defaultCurrency"),
            theme=preferences.get("theme", "system"),
        ),
        accounts=tuple(
            build_account_export(
                doc,
                expenses_by_account.get(doc["_id"], []),
                settlements_by_account.get(doc["_id"], []),
                language,
            )
            for doc in ordered
        ),
    )
