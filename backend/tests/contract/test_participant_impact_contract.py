from tests.conftest import auth_headers, participant_id


async def test_impact_counts_affected_expenses(client, create_user, create_account, create_expense):
    owner = await create_user()
    stranger = await create_user(email="stranger@mail.com")
    account = await create_account(owner)
    javier = participant_id(account, "Javier")
    leandro = participant_id(account, "Leandro")
    await create_expense(account, owner, paid_by=javier)  # paid and shared: counted once
    await create_expense(account, owner, participants=[javier])
    await create_expense(account, owner, participants=[leandro])
    await create_expense(account, owner, paid_by=javier, deleted=True)
    url = f"/accounts/{account['_id']}/participants/{javier}/impact"

    response = await client.get(url, headers=auth_headers(owner["_id"]))
    assert (response.status_code, response.json()) == (200, {"affectedExpenses": 2})

    stranger_response = await client.get(url, headers=auth_headers(stranger["_id"]))
    assert (stranger_response.status_code, stranger_response.json()["error"]["code"]) == (
        404,
        "not_found",
    )
    unknown = await client.get(
        f"/accounts/{account['_id']}/participants/nope/impact", headers=auth_headers(owner["_id"])
    )
    assert unknown.status_code == 404
