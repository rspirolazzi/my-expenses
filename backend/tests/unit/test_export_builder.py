"""Export model (feature 005, research R4 and R9). Pure functions, no database."""

import random
from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from bson import ObjectId

from app.services.balance_math import compute_balances, suggest_transfers
from app.services.export_builder import build_account_export, build_personal_export

ANA, LEANDRO, JAVIER = "p-ana", "p-leandro", "p-javier"
NOW = datetime(2026, 11, 12, 14, 3, tzinfo=UTC)


def _participant(pid: str, name: str, *, removed: bool = False, user: bool = True) -> dict:
    return {
        "id": pid,
        "name": name,
        "nameKey": name.lower(),
        "userId": ObjectId() if user else None,
        "joinedAt": NOW,
        "linkedAt": NOW if user else None,
        "removedAt": NOW if removed else None,
    }


def _account(*participants: dict[str, Any], currency: str = "ARS", **extra: Any) -> dict:
    return {
        "_id": ObjectId(),
        "name": "Vacaciones",
        "description": "Bariloche",
        "icon": "beach",
        "currency": currency,
        "ownerId": ObjectId(),
        "participants": list(participants),
        "inviteCode": "SECRET-INVITE",
        "isClosed": False,
        "closedAt": None,
        "isDeleted": False,
        **extra,
    }


def _expense(amount: int, paid_by: str | None, participants: list[str], **extra: Any) -> dict:
    return {
        "_id": ObjectId(),
        "accountId": ObjectId(),
        "date": "2026-11-10",
        "title": "Cena",
        "description": None,
        "amountMinor": amount,
        "currency": "ARS",
        "paidById": paid_by,
        "participantIds": participants,
        "categoryIcon": "food",
        "isDeleted": False,
        "createdBy": ObjectId(),
        "clientRequestId": "req-1",
        "createdAt": NOW,
        **extra,
    }


def _settlement(from_id: str, to_id: str, amount: int) -> dict:
    return {
        "_id": ObjectId(),
        "accountId": ObjectId(),
        "fromParticipantId": from_id,
        "toParticipantId": to_id,
        "amountMinor": amount,
        "currency": "ARS",
        "date": "2026-11-11",
        "isDeleted": False,
        "createdBy": ObjectId(),
        "clientRequestId": "req-2",
        "createdAt": NOW,
    }


def _base() -> dict:
    return _account(
        _participant(ANA, "Ana"), _participant(LEANDRO, "Leandro"), _participant(JAVIER, "Javier")
    )


ORDER = [ANA, LEANDRO, JAVIER]


def _minor(text: str) -> int:
    return int(Decimal(text) * 100)


def test_base_example() -> None:
    account = _base()
    result = build_account_export(
        account, [_expense(9000, ANA, ORDER)], [_settlement(LEANDRO, ANA, 3000)], "es"
    )
    assert (result.name, result.description, result.currency) == ("Vacaciones", "Bariloche", "ARS")
    assert result.currency_decimals == 2
    [expense] = result.expenses
    assert (expense.amount, expense.currency, expense.paid_by.name) == ("90.00", "ARS", "Ana")
    assert [(s.participant.name, s.amount) for s in expense.shares] == [
        ("Ana", "30.00"),
        ("Leandro", "30.00"),
        ("Javier", "30.00"),
    ]
    [settlement] = result.settlements
    assert (settlement.from_.name, settlement.to.name, settlement.amount) == (
        "Leandro",
        "Ana",
        "30.00",
    )
    assert not settlement.is_excluded
    assert [(b.participant.name, b.amount) for b in result.balances] == [
        ("Ana", "30.00"),
        ("Leandro", "0.00"),
        ("Javier", "-30.00"),
    ]
    assert [(s.from_.name, s.to.name, s.amount) for s in result.suggestions] == [
        ("Javier", "Ana", "30.00")
    ]
    assert result.pending_expenses == 0


def test_balances_and_suggestions_match_the_app() -> None:
    account = _base()
    expenses = [_expense(10000, ANA, ORDER), _expense(4500, JAVIER, [LEANDRO, JAVIER])]
    settlements = [_settlement(LEANDRO, ANA, 1000)]
    result = build_account_export(account, expenses, settlements, "es")
    expected = compute_balances(account, expenses, settlements).balances
    assert [(b.participant.id, _minor(b.amount)) for b in result.balances] == list(expected.items())
    transfers = suggest_transfers(expected, ORDER)
    assert [(s.from_.id, s.to.id, _minor(s.amount)) for s in result.suggestions] == [
        (t.from_id, t.to_id, t.amount_minor) for t in transfers
    ]


def test_indivisible_cents_follow_account_order() -> None:
    result = build_account_export(_base(), [_expense(10000, ANA, [JAVIER, ANA, LEANDRO])], [], "es")
    assert [(s.participant.id, s.amount) for s in result.expenses[0].shares] == [
        (ANA, "33.34"),
        (LEANDRO, "33.33"),
        (JAVIER, "33.33"),
    ]


def test_random_accounts_shares_add_up_and_balances_are_zero() -> None:
    rng = random.Random(5005)  # noqa: S311 - deterministic test data
    for _ in range(200):
        size = rng.randint(2, 8)
        ids = [f"p{i}" for i in range(size)]
        account = _account(*[_participant(pid, pid) for pid in ids])
        expenses = [
            _expense(
                rng.randint(1, 100_000), rng.choice(ids), rng.sample(ids, rng.randint(1, size))
            )
            for _ in range(rng.randint(0, 15))
        ]
        settlements = [
            _settlement(*rng.sample(ids, 2), rng.randint(1, 50_000))
            for _ in range(rng.randint(0, 5))
        ]
        result = build_account_export(account, expenses, settlements, "es")
        for expense in result.expenses:
            assert sum(_minor(s.amount) for s in expense.shares) == _minor(expense.amount)
        assert sum(_minor(b.amount) for b in result.balances) == 0


def test_currency_without_decimals() -> None:
    account = _account(_participant(ANA, "Ana"), _participant(JAVIER, "Javier"), currency="JPY")
    result = build_account_export(account, [_expense(1501, ANA, [ANA, JAVIER])], [], "es")
    assert result.currency_decimals == 0
    assert result.expenses[0].amount == "1501"
    assert [s.amount for s in result.expenses[0].shares] == ["751", "750"]
    assert [b.amount for b in result.balances] == ["750", "-750"]


def test_pending_expenses_are_marked() -> None:
    account = _base()
    expenses = [_expense(3000, None, ORDER), _expense(3000, ANA, [])]
    result = build_account_export(account, expenses, [], "es")
    assert [e.is_pending for e in result.expenses] == [True, True]
    assert result.expenses[0].paid_by is None
    assert result.expenses[1].shares == ()
    assert result.pending_expenses == 2
    assert [b.amount for b in result.balances] == ["0.00", "0.00", "0.00"]


def test_removed_participant_and_excluded_settlement() -> None:
    account = _account(
        _participant(ANA, "Ana"),
        _participant(LEANDRO, "Leandro", removed=True),
        _participant(JAVIER, "Javier"),
    )
    result = build_account_export(account, [], [_settlement(LEANDRO, ANA, 3000)], "es")
    assert [(p.name, p.is_removed) for p in result.participants] == [
        ("Ana", False),
        ("Leandro", True),
        ("Javier", False),
    ]
    assert result.settlements[0].is_excluded
    assert result.settlements[0].from_.name == "Leandro"
    assert [b.participant.name for b in result.balances] == ["Ana", "Javier"]


def test_unlinked_participant_is_only_a_name() -> None:
    account = _account(_participant(ANA, "Ana"), _participant(JAVIER, "Javier", user=False))
    result = build_account_export(account, [], [], "es")
    assert asdict(result.participants[1]) == {"id": JAVIER, "name": "Javier", "is_removed": False}


def test_closed_and_empty_account() -> None:
    account = _base()
    account.update(isClosed=True, closedAt=NOW)
    result = build_account_export(account, [], [], "es")
    assert (result.is_closed, result.closed_at) == (True, NOW)
    assert (result.expenses, result.settlements, result.suggestions) == ((), (), ())
    assert [b.amount for b in result.balances] == ["0.00", "0.00", "0.00"]


def test_keeps_the_input_order() -> None:
    first = _expense(1000, ANA, ORDER, title="B", date="2026-11-12")
    second = _expense(1000, ANA, ORDER, title="A", date="2026-11-01")
    result = build_account_export(_base(), [first, second], [], "es")
    assert [e.title for e in result.expenses] == ["B", "A"]


def test_never_copies_user_ids_or_secrets() -> None:
    account = _base()
    result = build_account_export(
        account, [_expense(9000, ANA, ORDER)], [_settlement(LEANDRO, ANA, 3000)], "es"
    )
    text = repr(result)
    for secret in [account["inviteCode"], str(account["ownerId"]), "req-1", "req-2"]:
        assert secret not in text
    for participant in account["participants"]:
        assert str(participant["userId"]) not in text


def test_category_label_follows_language() -> None:
    expense = _expense(1000, ANA, ORDER, categoryIcon="shopping")
    spanish = build_account_export(_base(), [expense], [], "es").expenses[0]
    english = build_account_export(_base(), [expense], [], "en").expenses[0]
    assert (spanish.category, spanish.category_label) == ("shopping", "Compras")
    assert (english.category, english.category_label) == ("shopping", "Shopping")


# --- build_personal_export (US2) ------------------------------------------------------------------


def _user(**extra: Any) -> dict:
    return {
        "_id": ObjectId(),
        "email": "ana@mail.com",
        "firstName": "Ana",
        "lastName": "Pérez",
        "passwordHash": "hash",
        "authProviders": ["password", "google"],
        "googleSub": "google-123",
        "pendingEmail": "nueva@mail.com",
        "preferences": {"language": "es", "defaultCurrency": "ARS", "theme": "dark"},
        **extra,
    }


def test_personal_export_copies_only_the_profile_fields() -> None:
    result = build_personal_export(_user(), [], {}, {}, "es")
    assert asdict(result.profile) == {
        "first_name": "Ana",
        "last_name": "Pérez",
        "email": "ana@mail.com",
        "language": "es",
        "default_currency": "ARS",
        "theme": "dark",
    }
    assert result.accounts == ()
    for secret in ["hash", "google-123", "nueva@mail.com"]:
        assert secret not in repr(result)


def test_personal_export_accounts_sorted_by_name_each_in_its_currency() -> None:
    usd = _account(_participant(ANA, "Ana"), _participant(JAVIER, "Javier"), currency="USD")
    usd["name"] = "Alquiler"
    ars = _base()
    expenses = {usd["_id"]: [_expense(1001, ANA, [ANA, JAVIER], currency="USD")], ars["_id"]: []}
    result = build_personal_export(_user(), [ars, usd], expenses, {}, "es")
    assert [(a.name, a.currency) for a in result.accounts] == [
        ("Alquiler", "USD"),
        ("Vacaciones", "ARS"),
    ]
    assert result.accounts[0].expenses[0].currency == "USD"
    assert [s.amount for s in result.accounts[0].expenses[0].shares] == ["5.01", "5.00"]
