"""Exporting an account end to end (feature 005, US1): content, permissions, audit, privacy."""

import io
import zipfile

import httpx
import pytest

from app.main import app
from app.repositories import accounts as accounts_repo
from app.services import audit_service
from tests.conftest import auth_headers, link, participant_id


def url(account) -> str:
    return f"/accounts/{account['_id']}/export"


async def _export(client, account, user, export_format="json", language="es"):
    headers = {**auth_headers(user["_id"]), "Accept-Language": language}
    return await client.get(url(account), params={"format": export_format}, headers=headers)


def _unzip(content: bytes) -> dict[str, str]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        return {name: archive.read(name).decode("utf-8-sig") for name in archive.namelist()}


async def test_matches_balances_and_expenses_of_the_app(
    client, db, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    account = await create_account(owner, name="Vacaciones")
    await link(db, account, "Leandro", member)
    ana, leandro = participant_id(account, "Ana"), participant_id(account, "Leandro")
    await create_expense(account, owner, amount_minor=9000, date="2026-11-10")
    await create_expense(account, owner, amount_minor=1000, date="2026-11-11")
    await create_settlement(account, owner, leandro, ana, amount_minor=3000)

    response = await _export(client, account, member)
    exported = response.json()["account"]
    headers = auth_headers(member["_id"])
    balances = (await client.get(f"/accounts/{account['_id']}/balances", headers=headers)).json()
    listing = (await client.get(f"/accounts/{account['_id']}/expenses", headers=headers)).json()

    assert [(b["participant"], b["amount"]) for b in exported["balances"]] == [
        (b["participant"], b["amount"]) for b in balances["balances"]
    ]
    assert [(s["from"], s["to"], s["amount"]) for s in exported["suggestions"]] == [
        (s["from"], s["to"], s["amount"]) for s in balances["suggestions"]
    ]
    assert [e["id"] for e in exported["expenses"]] == [e["id"] for e in listing["items"]]


async def test_deleted_and_foreign_records_are_left_out(
    client, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    account = await create_account(owner)
    other = await create_account(owner, name="Otra")
    ana, javier = participant_id(account, "Ana"), participant_id(account, "Javier")
    kept = await create_expense(account, owner)
    await create_expense(account, owner, deleted=True)
    await create_expense(other, owner)
    await create_settlement(account, owner, javier, ana, deleted=True)
    exported = (await _export(client, account, owner)).json()["account"]
    assert [e["id"] for e in exported["expenses"]] == [str(kept["_id"])]
    assert exported["settlements"] == []


async def test_closed_account_exports_the_same(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner, closed=True)
    await create_expense(account, owner)
    response = await _export(client, account, owner, "csv")
    assert response.status_code == 200
    rows = _unzip(response.content)["cuenta.csv"].splitlines()
    assert rows[1].split(",")[4] == "Sí"


async def test_english_headers_same_amounts(client, create_user, create_account, create_expense):
    owner = await create_user()
    account = await create_account(owner)
    await create_expense(account, owner, amount_minor=9000)
    spanish = _unzip((await _export(client, account, owner, "csv", "es")).content)
    english = _unzip((await _export(client, account, owner, "csv", "en")).content)
    assert spanish["saldos.csv"].splitlines()[0].startswith("ID del participante,Participante")
    assert english["balances.csv"].splitlines()[0].startswith("Participant ID,Participant")
    amounts = [line.split(",")[2] for line in spanish["saldos.csv"].splitlines()[1:]]
    assert amounts == [line.split(",")[2] for line in english["balances.csv"].splitlines()[1:]]
    assert amounts == ["60.00", "-30.00", "-30.00"]


async def test_each_export_is_audited(client, db, create_user, create_account):
    owner = await create_user()
    stranger = await create_user(email="otro@mail.com")
    account = await create_account(owner)
    await _export(client, account, owner, "csv")
    await _export(client, account, owner, "json")
    assert (await _export(client, account, stranger)).status_code == 404
    entries = await db.audit_logs.find({"action": "account.exported"}).to_list()
    assert [e["metadata"] for e in entries] == [{"format": "csv"}, {"format": "json"}]
    for entry in entries:
        assert entry["actorUserId"] == owner["_id"]
        assert entry["accountId"] == account["_id"]
        assert entry["entityType"] == "account"
        assert entry["changes"] == {}


async def test_never_contains_emails_user_ids_or_secrets(
    client, db, create_user, create_account, create_expense, create_settlement
):
    owner = await create_user()
    member = await create_user(email="leandro@mail.com")
    account = await create_account(owner)
    await link(db, account, "Leandro", member)
    ana, leandro = participant_id(account, "Ana"), participant_id(account, "Leandro")
    await create_expense(account, member)
    await create_settlement(account, member, leandro, ana)
    await db.expenses.update_many({}, {"$set": {"clientRequestId": "client-request-secret"}})
    stored = await db.accounts.find_one({"_id": account["_id"]})
    forbidden = [
        "ana@mail.com",
        "leandro@mail.com",
        str(owner["_id"]),
        str(member["_id"]),
        stored["inviteCode"],
        "client-request-secret",
    ]
    for export_format in ("json", "csv"):
        response = await _export(client, account, member, export_format)
        texts = (
            [response.text] if export_format == "json" else list(_unzip(response.content).values())
        )
        for text in texts:
            for value in forbidden:
                assert value not in text


async def test_audit_failure_returns_500_without_a_file(create_user, create_account, monkeypatch):
    owner = await create_user()
    account = await create_account(owner)

    async def broken(*args, **kwargs):
        raise RuntimeError("audit store is down")

    monkeypatch.setattr(audit_service, "record", broken)
    # Like a real server: unhandled errors become a 500 response instead of reaching the client.
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as http:
        response = await _export(http, account, owner)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "content-disposition" not in response.headers


async def test_membership_is_checked_inside_the_snapshot(
    client, db, create_user, create_account, monkeypatch
):
    owner = await create_user()
    account = await create_account(owner)
    original = accounts_repo.find_for_member

    async def gone_inside_snapshot(account_id, user_id, session=None):
        if session is not None:
            return None
        return await original(account_id, user_id)

    monkeypatch.setattr(accounts_repo, "find_for_member", gone_inside_snapshot)
    response = await _export(client, account, owner)
    assert response.status_code == 404
    assert await db.audit_logs.count_documents({"action": "account.exported"}) == 0


@pytest.mark.parametrize("export_format", ["csv", "json"])
async def test_logs_never_include_the_content(
    client, create_user, create_account, create_expense, caplog, export_format
):
    owner = await create_user()
    account = await create_account(owner, name="Cuenta privada")
    await create_expense(account, owner, title="Concepto privado")
    # INFO is the level the app runs with; DEBUG would include pymongo's own command dumps.
    with caplog.at_level("INFO"):
        assert (await _export(client, account, owner, export_format)).status_code == 200
    assert "Concepto privado" not in caplog.text
    assert "Cuenta privada" not in caplog.text
