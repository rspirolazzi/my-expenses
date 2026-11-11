"""Balances of an account and the user's balance in each of their accounts (research R1, R6).

Nothing here is stored: every read computes from the active expenses and settlements. Application
logs never include amounts or names (Principle VI).
"""

from collections import defaultdict
from typing import Any

from bson import ObjectId

from app.core.money import currency_decimals, format_amount
from app.repositories import expenses, settlements
from app.schemas.expense import ParticipantRef
from app.schemas.settlement import AccountBalances, BalanceEntry, SuggestedTransfer
from app.services.account_permissions import my_participant, require_member
from app.services.balance_math import compute_balances, suggest_transfers


def _names(account: dict[str, Any]) -> dict[str, str]:
    return {p["id"]: p["name"] for p in account["participants"]}


def _ref(names: dict[str, str], participant_id: str) -> ParticipantRef:
    return ParticipantRef(id=participant_id, name=names.get(participant_id, ""))


async def get_account_balances(account_id: str, user_id: ObjectId) -> AccountBalances:
    account = await require_member(account_id, user_id)
    expense_docs = await expenses.active_for_balances([account["_id"]])
    settlement_docs = await settlements.active_for_accounts([account["_id"]])
    result = compute_balances(account, expense_docs, settlement_docs)
    order = [p["id"] for p in account["participants"]]
    currency = account["currency"]
    names = _names(account)
    mine = my_participant(account, user_id)
    my_id = mine["id"] if mine else None
    return AccountBalances(
        currency=currency,
        currency_decimals=currency_decimals(currency),
        balances=[
            BalanceEntry(
                participant=_ref(names, pid),
                amount=format_amount(amount, currency),
                is_me=pid == my_id,
            )
            for pid, amount in result.balances.items()
        ],
        suggestions=[
            SuggestedTransfer(
                from_=_ref(names, t.from_id),
                to=_ref(names, t.to_id),
                amount=format_amount(t.amount_minor, currency),
            )
            for t in suggest_transfers(result.balances, order)
        ],
        pending_expenses=result.pending,
    )


async def my_balances(accounts: list[dict[str, Any]], user_id: ObjectId) -> dict[ObjectId, int]:
    """The user's balance in each account, with one query for expenses and one for settlements."""
    if not accounts:
        return {}
    ids = [doc["_id"] for doc in accounts]
    expenses_by_account: dict[ObjectId, list[dict[str, Any]]] = defaultdict(list)
    settlements_by_account: dict[ObjectId, list[dict[str, Any]]] = defaultdict(list)
    for doc in await expenses.active_for_balances(ids):
        expenses_by_account[doc["accountId"]].append(doc)
    for doc in await settlements.active_for_accounts(ids):
        settlements_by_account[doc["accountId"]].append(doc)
    result: dict[ObjectId, int] = {}
    for account in accounts:
        mine = my_participant(account, user_id)
        if mine is None:
            continue
        balances = compute_balances(
            account, expenses_by_account[account["_id"]], settlements_by_account[account["_id"]]
        ).balances
        result[account["_id"]] = balances.get(mine["id"], 0)
    return result
