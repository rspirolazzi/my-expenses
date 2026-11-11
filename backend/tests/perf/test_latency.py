"""Latency goals from plan.md. Excluded by default: run with `uv run pytest -m perf`."""

import statistics
import time

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.perf
REQUESTS = 100


def p95(samples: list[float]) -> float:
    return statistics.quantiles(samples, n=100)[94]


async def _measure(call) -> float:
    samples = []
    for _ in range(REQUESTS):
        started = time.perf_counter()
        await call()
        samples.append((time.perf_counter() - started) * 1000)
    return p95(samples)


async def test_login_p95_under_500ms(client, create_user, db):
    await create_user(email="ana@mail.com")

    async def login():
        response = await client.post(
            "/auth/login", json={"email": "ana@mail.com", "password": "correct-password"}
        )
        assert response.status_code == 200

    assert await _measure(login) < 500


async def test_get_me_p95_under_200ms(client, create_user):
    user = await create_user()
    headers = auth_headers(user["_id"])

    async def get_me():
        assert (await client.get("/users/me", headers=headers)).status_code == 200

    assert await _measure(get_me) < 200


async def test_my_accounts_p95_under_200ms(client, create_user, create_account):
    user = await create_user()
    for i in range(100):
        await create_account(user, name=f"Account {i}")
    headers = auth_headers(user["_id"])

    async def list_accounts():
        response = await client.get("/accounts", headers=headers)
        assert response.status_code == 200 and len(response.json()) == 100

    assert await _measure(list_accounts) < 200


async def _account_with_expenses(create_user, create_account, create_expense, count: int):
    owner = await create_user(email="perf@mail.com")
    account = await create_account(owner)
    for index in range(count):
        await create_expense(
            account, owner, title=f"e{index}", date=f"2026-{1 + index % 12:02d}-10"
        )
    return owner, account


async def test_expense_list_p95_under_300ms(client, create_user, create_account, create_expense):
    owner, account = await _account_with_expenses(create_user, create_account, create_expense, 500)
    headers = auth_headers(owner["_id"])
    url = f"/accounts/{account['_id']}/expenses"
    first = (await client.get(url, headers=headers)).json()

    async def first_page():
        response = await client.get(url, headers=headers)
        assert len(response.json()["items"]) == 50

    async def next_page():
        response = await client.get(url, params={"cursor": first["nextCursor"]}, headers=headers)
        assert response.status_code == 200

    assert await _measure(first_page) < 300
    assert await _measure(next_page) < 300


async def test_participant_removal_with_500_expenses_under_2s(
    client, create_user, create_account, create_expense
):
    owner, account = await _account_with_expenses(create_user, create_account, create_expense, 500)
    javier = next(p["id"] for p in account["participants"] if p["name"] == "Javier")
    started = time.perf_counter()
    response = await client.delete(
        f"/accounts/{account['_id']}/participants/{javier}", headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    assert time.perf_counter() - started < 2
