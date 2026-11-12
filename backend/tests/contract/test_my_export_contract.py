"""GET /users/me/export (feature 005, contracts/api.md)."""

import io
import zipfile

import pytest

from tests.conftest import auth_headers

URL = "/users/me/export"


async def test_json_export(client, create_user):
    user = await create_user()
    response = await client.get(URL, params={"format": "json"}, headers=auth_headers(user["_id"]))
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json; charset=utf-8"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"].startswith('attachment; filename="mis-gastos_2')
    document = response.json()
    assert (document["scope"], document["accounts"]) == ("all", [])
    assert set(document["profile"]) == {
        "firstName",
        "lastName",
        "email",
        "language",
        "defaultCurrency",
        "theme",
    }


async def test_csv_export(client, create_user):
    user = await create_user()
    response = await client.get(URL, params={"format": "csv"}, headers=auth_headers(user["_id"]))
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert '.zip"' in response.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist() == ["perfil.csv"]


@pytest.mark.parametrize("params", [{}, {"format": "pdf"}])
async def test_invalid_format(client, create_user, params):
    user = await create_user()
    response = await client.get(URL, params=params, headers=auth_headers(user["_id"]))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_requires_a_token(client):
    response = await client.get(URL, params={"format": "json"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
