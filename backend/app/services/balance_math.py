"""Balances and suggested transfers as pure functions (research R1–R3). No I/O.

Amounts are integer minor units. Shares come from `split_equal`, the same rule as the expense
detail, so the balances always add up to exactly zero.
"""

from dataclasses import dataclass
from typing import Any

from app.core.money import split_equal


@dataclass(frozen=True)
class BalanceResult:
    balances: dict[str, int]  # active participant id -> balance, in the account's order
    pending: int  # active expenses without payer or without participants


@dataclass(frozen=True)
class Transfer:
    from_id: str
    to_id: str
    amount_minor: int


def _active_ids(account: dict[str, Any]) -> list[str]:
    return [p["id"] for p in account["participants"] if p.get("removedAt") is None]


def is_pending(expense: dict[str, Any]) -> bool:
    return expense.get("paidById") is None or not expense.get("participantIds")


def settlement_counts(settlement: dict[str, Any], active: set[str]) -> bool:
    """A settlement counts while both sides are active participants (FR-005)."""
    return (
        not settlement.get("isDeleted")
        and settlement["fromParticipantId"] in active
        and settlement["toParticipantId"] in active
    )


def compute_balances(
    account: dict[str, Any],
    expenses: list[dict[str, Any]],
    settlements: list[dict[str, Any]],
) -> BalanceResult:
    """paid − share + settlements paid − settlements received, per active participant."""
    order = [p["id"] for p in account["participants"]]
    active_order = _active_ids(account)
    active = set(active_order)
    totals: dict[str, int] = dict.fromkeys(order, 0)
    pending = 0
    for expense in expenses:
        if expense.get("isDeleted"):
            continue
        if is_pending(expense):
            pending += 1
            continue
        amount = expense["amountMinor"]
        totals[expense["paidById"]] = totals.get(expense["paidById"], 0) + amount
        for pid, share in split_equal(amount, expense["participantIds"], order).items():
            totals[pid] = totals.get(pid, 0) - share
    for settlement in settlements:
        if not settlement_counts(settlement, active):
            continue
        amount = settlement["amountMinor"]
        totals[settlement["fromParticipantId"]] += amount
        totals[settlement["toParticipantId"]] -= amount
    return BalanceResult(balances={pid: totals[pid] for pid in active_order}, pending=pending)


def suggest_transfers(balances: dict[str, int], order: list[str]) -> list[Transfer]:
    """At most N−1 transfers that settle everything; same balances give the same result (R3).

    1. Exact pairs first: each debtor, in account order, pays the first creditor (account order)
       who is owed exactly the same amount.
    2. Then greedy: the largest debtor pays the largest creditor the smaller of both amounts.
       Ties are resolved by the account order.
    """
    position = {pid: index for index, pid in enumerate(order)}

    def rank(pid: str) -> int:
        return position.get(pid, len(position))

    remaining = {pid: value for pid, value in balances.items() if value != 0}
    transfers: list[Transfer] = []

    debtors = sorted((pid for pid, v in remaining.items() if v < 0), key=rank)
    for debtor in debtors:
        owed = -remaining[debtor]
        creditor = next(
            (
                pid
                for pid in sorted(remaining, key=rank)
                if remaining[pid] == owed and remaining[pid] > 0
            ),
            None,
        )
        if creditor is not None:
            transfers.append(Transfer(debtor, creditor, owed))
            remaining[debtor] = 0
            remaining[creditor] = 0

    while True:
        debtors = [pid for pid, v in remaining.items() if v < 0]
        creditors = [pid for pid, v in remaining.items() if v > 0]
        if not debtors or not creditors:
            break
        debtor = min(debtors, key=lambda pid: (remaining[pid], rank(pid)))
        creditor = min(creditors, key=lambda pid: (-remaining[pid], rank(pid)))
        amount = min(-remaining[debtor], remaining[creditor])
        transfers.append(Transfer(debtor, creditor, amount))
        remaining[debtor] += amount
        remaining[creditor] -= amount
    return transfers
