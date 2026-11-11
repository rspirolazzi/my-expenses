"""Balances and suggested transfers (research R1–R3). Pure functions, no database."""

import random
from datetime import UTC, datetime
from typing import Any

import pytest

from app.services.balance_math import compute_balances, suggest_transfers

ANA, LEANDRO, JAVIER, DIEGO = "p-ana", "p-leandro", "p-javier", "p-diego"


def _participant(pid: str, *, removed: bool = False, linked: bool = True) -> dict[str, Any]:
    return {
        "id": pid,
        "name": pid,
        "userId": "u-" + pid if linked else None,
        "removedAt": datetime.now(UTC) if removed else None,
    }


def _account(*participants: dict[str, Any], currency: str = "ARS") -> dict[str, Any]:
    return {"currency": currency, "participants": list(participants)}


def _expense(amount: int, paid_by: str | None, participants: list[str]) -> dict[str, Any]:
    return {"amountMinor": amount, "paidById": paid_by, "participantIds": participants}


def _settlement(from_id: str, to_id: str, amount: int) -> dict[str, Any]:
    return {"fromParticipantId": from_id, "toParticipantId": to_id, "amountMinor": amount}


BASE = _account(_participant(ANA), _participant(LEANDRO), _participant(JAVIER))
ORDER = [ANA, LEANDRO, JAVIER]


# --- compute_balances -----------------------------------------------------------------------------


def test_base_example() -> None:
    result = compute_balances(BASE, [_expense(9000, ANA, ORDER)], [])
    assert result.balances == {ANA: 6000, LEANDRO: -3000, JAVIER: -3000}
    assert result.pending == 0


def test_balances_follow_account_order() -> None:
    result = compute_balances(BASE, [_expense(9000, ANA, ORDER)], [])
    assert list(result.balances) == ORDER


def test_indivisible_cents_go_to_the_first_in_account_order() -> None:
    result = compute_balances(BASE, [_expense(10000, ANA, ORDER)], [])
    # Shares 3334 / 3333 / 3333: the extra cent is Ana's (first in the account).
    assert result.balances == {ANA: 6666, LEANDRO: -3333, JAVIER: -3333}
    assert sum(result.balances.values()) == 0


def test_single_participant_is_always_zero() -> None:
    account = _account(_participant(ANA))
    result = compute_balances(account, [_expense(5000, ANA, [ANA])], [])
    assert result.balances == {ANA: 0}


def test_payer_who_does_not_share_is_owed_the_total() -> None:
    result = compute_balances(BASE, [_expense(6000, ANA, [LEANDRO, JAVIER])], [])
    assert result.balances == {ANA: 6000, LEANDRO: -3000, JAVIER: -3000}


@pytest.mark.parametrize(
    "pending", [_expense(5000, None, ORDER), _expense(5000, ANA, [])], ids=["no-payer", "no-shares"]
)
def test_pending_expense_does_not_count(pending: dict[str, Any]) -> None:
    result = compute_balances(BASE, [_expense(9000, ANA, ORDER), pending], [])
    assert result.balances == {ANA: 6000, LEANDRO: -3000, JAVIER: -3000}
    assert result.pending == 1


def test_deleted_expense_does_not_count() -> None:
    deleted = {**_expense(5000, LEANDRO, ORDER), "isDeleted": True}
    result = compute_balances(BASE, [_expense(9000, ANA, ORDER), deleted], [])
    assert result.balances == {ANA: 6000, LEANDRO: -3000, JAVIER: -3000}
    assert result.pending == 0


def test_settlement_moves_both_balances() -> None:
    result = compute_balances(BASE, [_expense(9000, ANA, ORDER)], [_settlement(LEANDRO, ANA, 3000)])
    assert result.balances == {ANA: 3000, LEANDRO: 0, JAVIER: -3000}


def test_settlement_larger_than_the_debt_flips_the_sign() -> None:
    result = compute_balances(BASE, [_expense(9000, ANA, ORDER)], [_settlement(JAVIER, ANA, 5000)])
    assert result.balances == {ANA: 1000, LEANDRO: -3000, JAVIER: 2000}


def test_settlement_with_a_removed_side_does_not_count() -> None:
    account = _account(
        _participant(ANA),
        _participant(LEANDRO),
        _participant(JAVIER),
        _participant(DIEGO, removed=True),
    )
    result = compute_balances(
        account,
        [_expense(9000, ANA, ORDER)],
        [_settlement(DIEGO, ANA, 1000), _settlement(LEANDRO, DIEGO, 500)],
    )
    assert result.balances == {ANA: 6000, LEANDRO: -3000, JAVIER: -3000}


def test_removed_participant_is_not_in_the_result() -> None:
    account = _account(_participant(ANA), _participant(LEANDRO), _participant(JAVIER, removed=True))
    result = compute_balances(account, [_expense(4000, ANA, [ANA, LEANDRO])], [])
    assert result.balances == {ANA: 2000, LEANDRO: -2000}


def test_unlinked_participant_counts() -> None:
    account = _account(_participant(ANA), _participant(LEANDRO, linked=False))
    result = compute_balances(account, [_expense(4000, ANA, [ANA, LEANDRO])], [])
    assert result.balances == {ANA: 2000, LEANDRO: -2000}


def test_currency_without_decimals_gives_integers() -> None:
    account = _account(
        _participant(ANA), _participant(LEANDRO), _participant(JAVIER), currency="JPY"
    )
    result = compute_balances(account, [_expense(1000, ANA, ORDER)], [])
    assert result.balances == {ANA: 666, LEANDRO: -333, JAVIER: -333}
    assert all(isinstance(value, int) for value in result.balances.values())


def _random_case(rng: random.Random) -> tuple[dict[str, Any], list, list]:
    count = rng.randint(2, 10)
    ids = [f"p{i}" for i in range(count)]
    removed = {pid for pid in ids[1:] if rng.random() < 0.15}
    account = _account(*(_participant(pid, removed=pid in removed) for pid in ids))
    active = [pid for pid in ids if pid not in removed]
    expenses = []
    for _ in range(rng.randint(0, 25)):
        shares = rng.sample(active, rng.randint(0, len(active)))
        payer = rng.choice(active) if rng.random() > 0.1 else None
        expenses.append(_expense(rng.randint(1, 1_000_000), payer, shares))
    settlements = []
    for _ in range(rng.randint(0, 8)):
        from_id, to_id = rng.sample(ids, 2)
        settlements.append(_settlement(from_id, to_id, rng.randint(1, 500_000)))
    return account, expenses, settlements


def test_property_sum_is_always_zero() -> None:
    rng = random.Random(4004)  # noqa: S311 - deterministic test data
    for _ in range(500):
        account, expenses, settlements = _random_case(rng)
        result = compute_balances(account, expenses, settlements)
        assert sum(result.balances.values()) == 0


# --- suggest_transfers ----------------------------------------------------------------------------


def _apply(balances: dict[str, int], transfers) -> dict[str, int]:
    after = dict(balances)
    for transfer in transfers:
        after[transfer.from_id] += transfer.amount_minor
        after[transfer.to_id] -= transfer.amount_minor
    return after


def test_suggestions_for_the_base_example() -> None:
    transfers = suggest_transfers({ANA: 6000, LEANDRO: -3000, JAVIER: -3000}, ORDER)
    assert [(t.from_id, t.to_id, t.amount_minor) for t in transfers] == [
        (LEANDRO, ANA, 3000),
        (JAVIER, ANA, 3000),
    ]


def test_no_suggestions_when_all_are_zero() -> None:
    assert suggest_transfers({ANA: 0, LEANDRO: 0}, [ANA, LEANDRO]) == []


def test_exact_pairs_first() -> None:
    order = ["A", "B", "C", "D"]
    transfers = suggest_transfers({"A": 50, "B": 30, "C": -30, "D": -50}, order)
    assert [(t.from_id, t.to_id, t.amount_minor) for t in transfers] == [
        ("C", "B", 30),
        ("D", "A", 50),
    ]


def test_same_result_with_another_input_order() -> None:
    order = ["A", "B", "C", "D", "E"]
    balances = {"A": 700, "B": -200, "C": 100, "D": -450, "E": -150}
    shuffled = dict(reversed(list(balances.items())))
    assert suggest_transfers(balances, order) == suggest_transfers(shuffled, order)


def test_ties_follow_the_account_order() -> None:
    transfers = suggest_transfers({"X": -100, "Y": -100, "Z": 200}, ["Y", "X", "Z"])
    assert [t.from_id for t in transfers] == ["Y", "X"]


def test_amounts_are_always_positive() -> None:
    transfers = suggest_transfers({"A": 1, "B": 2, "C": -3}, ["A", "B", "C"])
    assert all(t.amount_minor > 0 for t in transfers)


def test_property_settles_everything_with_at_most_n_minus_one() -> None:
    rng = random.Random(4005)  # noqa: S311 - deterministic test data
    for _ in range(500):
        account, expenses, settlements = _random_case(rng)
        balances = compute_balances(account, expenses, settlements).balances
        order = [p["id"] for p in account["participants"]]
        transfers = suggest_transfers(balances, order)
        nonzero = sum(1 for value in balances.values() if value != 0)
        assert len(transfers) <= max(nonzero - 1, 0)
        assert all(t.amount_minor > 0 for t in transfers)
        assert all(value == 0 for value in _apply(balances, transfers).values())
        assert transfers == suggest_transfers(balances, order)
