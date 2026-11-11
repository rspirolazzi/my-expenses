import pytest

from tests.conftest import auth_headers


async def test_first_page_has_total_and_count(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=1050)
    await create_expense(account, owner, amount_minor=2000)
    response = await client.get(
        f"/accounts/{account['_id']}/expenses", headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"items", "nextCursor", "total", "count"}
    assert (body["total"], body["count"], body["nextCursor"]) == ("30.50", 2, None)
    assert set(body["items"][0]) == {
        "id",
        "date",
        "title",
        "categoryIcon",
        "amount",
        "paidBy",
        "isPending",
    }


async def test_next_pages_have_no_total(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    for _ in range(3):
        await create_expense(account, owner)
    headers = auth_headers(owner["_id"])
    url = f"/accounts/{account['_id']}/expenses"
    first = (await client.get(url, params={"limit": 2}, headers=headers)).json()
    assert first["nextCursor"]
    second = (
        await client.get(url, params={"limit": 2, "cursor": first["nextCursor"]}, headers=headers)
    ).json()
    assert (second["total"], second["count"], second["nextCursor"]) == (None, None, None)
    assert len(second["items"]) == 1


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"cursor": "not-a-cursor"}])
async def test_invalid_paging(client, create_user, create_account, params):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.get(
        f"/accounts/{account['_id']}/expenses", params=params, headers=auth_headers(owner["_id"])
    )
    assert (response.status_code, response.json()["error"]["code"]) == (422, "validation_error")


async def test_non_members_get_404(client, create_user, create_account):
    owner = await create_user()
    stranger = await create_user(email="stranger@mail.com")
    account = await create_account(owner)
    response = await client.get(
        f"/accounts/{account['_id']}/expenses", headers=auth_headers(stranger["_id"])
    )
    assert (response.status_code, response.json()["error"]["code"]) == (404, "not_found")
