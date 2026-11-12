"""GET /accounts/{id}/export (feature 005, contracts/api.md)."""

import io
import json
import zipfile

import pytest
from bson import ObjectId

from tests.conftest import auth_headers, participant_id

ACCOUNT_KEYS = {
    "id",
    "name",
    "description",
    "currency",
    "currencyDecimals",
    "isClosed",
    "closedAt",
    "pendingExpenses",
    "participants",
    "expenses",
    "settlements",
    "balances",
    "suggestions",
}


def url(account_id) -> str:
    return f"/accounts/{account_id}/export"


async def test_json_export(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner, name="Vacaciones")
    await create_expense(account, owner, amount_minor=9000)
    response = await client.get(
        url(account["_id"]), params={"format": "json"}, headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json; charset=utf-8"
    assert response.headers["cache-control"] == "no-store"
    disposition = response.headers["content-disposition"]
    assert disposition.startswith('attachment; filename="mis-gastos_vacaciones_')
    assert ".json\"; filename*=UTF-8''mis-gastos_vacaciones_" in disposition
    document = response.json()
    assert (document["formatVersion"], document["scope"], document["language"]) == (
        1,
        "account",
        "es",
    )
    assert document["exportedAt"].endswith("Z")
    assert set(document["account"]) == ACCOUNT_KEYS
    ana = participant_id(account, "Ana")
    assert document["account"]["balances"][0] == {
        "participant": {"id": ana, "name": "Ana"},
        "amount": "60.00",
        "currency": "ARS",
    }


async def test_csv_export_is_a_zip(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, name="Vacaciones")
    response = await client.get(
        url(account["_id"]), params={"format": "csv"}, headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["cache-control"] == "no-store"
    assert '.zip"' in response.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist()[0] == "cuenta.csv"
        assert len(archive.namelist()) == 7


async def test_english_file_names(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner, name="Trip")
    headers = {**auth_headers(owner["_id"]), "Accept-Language": "en"}
    response = await client.get(url(account["_id"]), params={"format": "csv"}, headers=headers)
    assert 'filename="my-expenses_trip_' in response.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist()[0] == "account.csv"


@pytest.mark.parametrize("params", [{}, {"format": "xlsx"}, {"format": "CSV"}])
async def test_invalid_format(client, create_user, create_account, params):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.get(
        url(account["_id"]), params=params, headers=auth_headers(owner["_id"])
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_requires_a_token(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    response = await client.get(url(account["_id"]), params={"format": "json"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_not_found_looks_the_same_for_every_case(client, create_user, create_account):
    owner = await create_user()
    stranger = await create_user(email="otro@mail.com")
    account = await create_account(owner)
    deleted = await create_account(owner, deleted=True)
    bodies = []
    for account_id, user in [
        (account["_id"], stranger),
        (ObjectId(), owner),
        ("not-an-id", owner),
        (deleted["_id"], owner),
    ]:
        response = await client.get(
            url(account_id), params={"format": "json"}, headers=auth_headers(user["_id"])
        )
        assert response.status_code == 404
        bodies.append(json.dumps(response.json(), sort_keys=True))
    assert len(set(bodies)) == 1
