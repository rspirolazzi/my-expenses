from tests.conftest import auth_headers, link


async def test_close(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    url = f"/accounts/{account['_id']}/close"

    forbidden = await client.post(url, headers=auth_headers(member["_id"]))
    assert (forbidden.status_code, forbidden.json()["error"]["code"]) == (403, "owner_only")

    closed = await client.post(url, headers=auth_headers(owner["_id"]))
    assert closed.status_code == 200
    assert closed.json()["isClosed"] is True and closed.json()["closedAt"]

    again = await client.post(url, headers=auth_headers(owner["_id"]))
    assert (again.status_code, again.json()["error"]["code"]) == (409, "account_closed")


async def test_delete(client, db, create_user, create_account):
    owner = await create_user()
    member = await create_user(email="member@mail.com")
    account = await create_account(owner)
    closed = await create_account(owner, name="Closed", closed=True)
    await link(db, account, "Leandro", member)

    forbidden = await client.delete(
        f"/accounts/{account['_id']}", headers=auth_headers(member["_id"])
    )
    assert (forbidden.status_code, forbidden.json()["error"]["code"]) == (403, "owner_only")

    for target in (account, closed):
        response = await client.delete(
            f"/accounts/{target['_id']}", headers=auth_headers(owner["_id"])
        )
        assert response.status_code == 204
