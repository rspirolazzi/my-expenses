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
