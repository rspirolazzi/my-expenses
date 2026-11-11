from datetime import UTC, datetime, timedelta

from tests.conftest import auth_headers, participant_id
from tests.contract.test_settlements_create_contract import SETTLEMENT_FIELDS


def url(account) -> str:
    return f"/accounts/{account['_id']}/settlements"


async def test_page_is_ordered_by_date_then_creation(
    client, create_user, create_account, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    leandro, ana = participant_id(account, "Leandro"), participant_id(account, "Ana")
    now = datetime.now(UTC)
    old = await create_settlement(account, owner, leandro, ana, date="2026-11-01")
    first = await create_settlement(account, owner, leandro, ana, date="2026-11-10", created_at=now)
    later = await create_settlement(
        account, owner, leandro, ana, date="2026-11-10", created_at=now + timedelta(seconds=1)
    )
    await create_settlement(account, owner, leandro, ana, date="2026-11-12", deleted=True)
    response = await client.get(url(account), headers=auth_headers(owner["_id"]))
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"items", "nextCursor"}
    assert body["nextCursor"] is None
    assert [item["id"] for item in body["items"]] == [
        str(later["_id"]),
        str(first["_id"]),
        str(old["_id"]),
    ]
    assert set(body["items"][0]) == SETTLEMENT_FIELDS
    assert body["items"][0]["amount"] == "10.00"


async def test_pages_of_50_without_repeats(client, create_user, create_account, create_settlement):
    owner = await create_user()
    account = await create_account(owner)
    leandro, ana = participant_id(account, "Leandro"), participant_id(account, "Ana")
    now = datetime.now(UTC)
    for i in range(120):
        await create_settlement(
            account, owner, leandro, ana, date="2026-11-11", created_at=now + timedelta(seconds=i)
        )
    headers = auth_headers(owner["_id"])
    seen: list[str] = []
    cursor = None
    pages = 0
    while True:
        query = f"?cursor={cursor}" if cursor else ""
        body = (await client.get(url(account) + query, headers=headers)).json()
        pages += 1
        seen += [item["id"] for item in body["items"]]
        cursor = body["nextCursor"]
        if cursor is None:
            break
    assert pages == 3
    assert len(seen) == len(set(seen)) == 120


async def test_invalid_limit_and_cursor(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    for query in ("?limit=0", "?limit=101", "?cursor=not-a-cursor"):
        response = await client.get(url(account) + query, headers=headers)
        assert (response.status_code, response.json()["error"]["code"]) == (
            422,
            "validation_error",
        )


async def test_not_found_for_outsiders(client, create_user, create_account):
    owner = await create_user()
    outsider = await create_user(email="otro@mail.com")
    account = await create_account(owner)
    response = await client.get(url(account), headers=auth_headers(outsider["_id"]))
    assert response.status_code == 404


async def test_removed_participant_settlements_are_listed_as_excluded(
    client, create_user, create_account, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    javier, ana = participant_id(account, "Javier"), participant_id(account, "Ana")
    await create_settlement(account, owner, javier, ana)
    await client.delete(f"/accounts/{account['_id']}/participants/{javier}", headers=headers)
    item = (await client.get(url(account), headers=headers)).json()["items"][0]
    assert item["isExcluded"] is True
    assert item["from"] == {"id": javier, "name": "Javier"}
