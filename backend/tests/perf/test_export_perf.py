"""Latency goals of feature 005 (plan.md, SC-003 and SC-004). Run with `uv run pytest -m perf`."""

import pytest

from tests.conftest import auth_headers
from tests.perf.test_balances_perf import _fill
from tests.perf.test_latency import _measure

pytestmark = pytest.mark.perf


@pytest.mark.parametrize("export_format", ["csv", "json"])
async def test_account_export_p95_under_1s(client, db, create_user, create_account, export_format):
    owner = await create_user()
    account = await create_account(owner, others=tuple(f"P{i}" for i in range(9)))
    await _fill(db, account, owner, expenses=500, settlements=100)
    headers = auth_headers(owner["_id"])

    async def export():
        response = await client.get(
            f"/accounts/{account['_id']}/export",
            params={"format": export_format},
            headers=headers,
        )
        assert response.status_code == 200

    assert await _measure(export) < 1000


@pytest.mark.parametrize("export_format", ["csv", "json"])
async def test_export_all_my_data_p95_under_3s(
    client, db, create_user, create_account, export_format
):
    owner = await create_user()
    for i in range(20):
        account = await create_account(owner, name=f"Cuenta {i}")
        await _fill(db, account, owner, expenses=500, settlements=0)
    headers = auth_headers(owner["_id"])

    async def export():
        response = await client.get(
            "/users/me/export", params={"format": export_format}, headers=headers
        )
        assert response.status_code == 200

    assert await _measure(export) < 3000
