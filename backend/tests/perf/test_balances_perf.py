"""Latency goals of feature 004 (plan.md). Excluded by default: run with `uv run pytest -m perf`."""

from datetime import UTC, datetime

import pytest

from app.repositories import expenses as expenses_repo
from app.repositories import settlements as settlements_repo
from tests.conftest import auth_headers
from tests.perf.test_latency import _measure

pytestmark = pytest.mark.perf


async def _fill(db, account, owner, expenses: int, settlements: int) -> None:
    ids = [p["id"] for p in account["participants"]]
    expense_docs = []
    for i in range(expenses):
        doc = expenses_repo.new_expense_document(
            account=account,
            expense_date=datetime.now(UTC).date(),
            title=f"Gasto {i}",
            description=None,
            amount_minor=1000 + i,
            paid_by_id=ids[i % len(ids)],
            participant_ids=ids,
            category_icon="food",
            created_by=owner["_id"],
            client_request_id=None,
        )
        expense_docs.append(doc)
    if expense_docs:
        await db.expenses.insert_many(expense_docs)
    settlement_docs = [
        settlements_repo.new_settlement_document(
            account=account,
            from_participant_id=ids[(i + 1) % len(ids)],
            to_participant_id=ids[i % len(ids)],
            amount_minor=500 + i,
            settlement_date=datetime.now(UTC).date(),
            created_by=owner["_id"],
            client_request_id=None,
        )
        for i in range(settlements)
    ]
    if settlement_docs:
        await db.settlements.insert_many(settlement_docs)


async def test_balances_p95_under_300ms(client, db, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, others=tuple(f"P{i}" for i in range(9)))
    await _fill(db, account, owner, expenses=500, settlements=100)
    headers = auth_headers(owner["_id"])

    async def get_balances():
        response = await client.get(f"/accounts/{account['_id']}/balances", headers=headers)
        assert response.status_code == 200

    assert await _measure(get_balances) < 300


async def test_my_accounts_with_balances_p95_under_500ms(client, db, create_user, create_account):
    owner = await create_user()
    for i in range(20):
        account = await create_account(owner, name=f"Cuenta {i}")
        await _fill(db, account, owner, expenses=500, settlements=0)
    headers = auth_headers(owner["_id"])

    async def list_accounts():
        response = await client.get("/accounts", headers=headers)
        assert response.status_code == 200 and len(response.json()) == 20

    assert await _measure(list_accounts) < 500
