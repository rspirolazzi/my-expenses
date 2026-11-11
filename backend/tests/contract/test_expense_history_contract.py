from tests.conftest import auth_headers
from tests.contract.test_expenses_create_contract import payload


async def test_history_shape(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    headers = auth_headers(owner["_id"])
    created = await client.post(
        f"/accounts/{account['_id']}/expenses", json=payload(account), headers=headers
    )
    response = await client.get(
        f"/accounts/{account['_id']}/expenses/{created.json()['id']}/history", headers=headers
    )
    assert response.status_code == 200
    [entry] = response.json()
    assert entry["action"] == "created"
    assert entry["reason"] is None
    fields = {change["field"] for change in entry["changes"]}
    assert fields == {
        "date",
        "title",
        "amount",
        "paidBy",
        "participants",
        "categoryIcon",
        "description",
    }
    for change in entry["changes"]:
        assert set(change) == {"field", "before", "after"}
        assert change["before"] is None
