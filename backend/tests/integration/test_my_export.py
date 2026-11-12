"""Exporting all my data end to end (feature 005, US2)."""

import io
import zipfile

from tests.conftest import auth_headers, link

URL = "/users/me/export"


async def _export(client, user, export_format="json"):
    return await client.get(
        URL, params={"format": export_format}, headers=auth_headers(user["_id"])
    )


async def test_includes_open_and_closed_accounts_but_not_left_deleted_or_foreign(
    client, db, create_user, create_account, create_expense
):
    ana = await create_user()
    other = await create_user(email="otro@mail.com")
    open_account = await create_account(ana, name="Vacaciones", currency="ARS")
    closed = await create_account(ana, name="Alquiler", currency="USD", closed=True)
    await create_account(ana, name="Borrada", deleted=True)
    left = await create_account(other, name="Abandonada")
    await link(db, left, "Leandro", ana)
    await db.accounts.update_one(
        {"_id": left["_id"], "participants.name": "Leandro"},
        {"$set": {"participants.$.userId": None}},
    )
    await create_account(other, name="Ajena")
    await create_expense(open_account, ana, amount_minor=9000)
    await create_expense(closed, ana, amount_minor=3001)

    document = (await _export(client, ana)).json()
    assert [(a["name"], a["currency"], a["isClosed"]) for a in document["accounts"]] == [
        ("Alquiler", "USD", True),
        ("Vacaciones", "ARS", False),
    ]
    alquiler, vacaciones = document["accounts"]
    assert {e["currency"] for e in alquiler["expenses"]} == {"USD"}
    assert alquiler["expenses"][0]["amount"] == "30.01"
    assert vacaciones["expenses"][0]["amount"] == "90.00"
    assert document["profile"]["email"] == "ana@mail.com"


async def test_user_without_accounts_gets_only_the_profile(client, create_user):
    user = await create_user()
    document = (await _export(client, user)).json()
    assert document["accounts"] == []
    assert document["profile"]["language"] == "es"


async def test_zip_has_profile_and_one_folder_per_account(client, create_user, create_account):
    ana = await create_user()
    await create_account(ana, name="Casa")
    await create_account(ana, name="Casa")
    response = await _export(client, ana, "csv")
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = archive.namelist()
    assert names[0] == "perfil.csv"
    folders = {name.split("/")[0] for name in names[1:]}
    assert len(folders) == 2
    assert all(folder.startswith("casa_") for folder in folders)


async def test_each_export_is_audited(client, db, create_user, create_account):
    ana = await create_user()
    await create_account(ana)
    await create_account(ana, name="Otra")
    await _export(client, ana, "csv")
    entry = await db.audit_logs.find_one({"action": "user.data_exported"})
    assert entry["metadata"] == {"format": "csv", "accountCount": 2}
    assert (entry["actorUserId"], entry["entityId"]) == (ana["_id"], ana["_id"])
    assert entry["changes"] == {}


async def test_only_my_own_email_appears(client, db, create_user, create_account, create_expense):
    ana = await create_user()
    leandro = await create_user(email="leandro@mail.com")
    account = await create_account(ana)
    await link(db, account, "Leandro", leandro)
    await create_expense(account, leandro)
    stored = await db.accounts.find_one({"_id": account["_id"]})
    for export_format in ("json", "csv"):
        response = await _export(client, ana, export_format)
        if export_format == "json":
            texts = [response.text]
        else:
            with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                texts = [archive.read(n).decode("utf-8-sig") for n in archive.namelist()]
        joined = "\n".join(texts)
        assert "ana@mail.com" in joined
        for value in [
            "leandro@mail.com",
            str(ana["_id"]),
            str(leandro["_id"]),
            stored["inviteCode"],
        ]:
            assert value not in joined
