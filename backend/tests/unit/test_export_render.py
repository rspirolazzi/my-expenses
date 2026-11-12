"""CSV/ZIP and JSON rendering of exports (feature 005, research R5–R8). Pure functions."""

import codecs
import csv
import io
import json
import zipfile
from datetime import UTC, datetime
from typing import Any

import pytest
from bson import ObjectId

from app.services.export_builder import build_account_export, build_personal_export
from app.services.export_render import (
    account_folder,
    content_disposition,
    file_name,
    render_csv_zip,
    render_json,
    slugify,
)

ANA, LEANDRO, JAVIER = "p-ana", "p-leandro", "p-javier"
NOW = datetime(2026, 11, 12, 14, 3, 9, tzinfo=UTC)

ES_FILES = [
    "cuenta.csv",
    "participantes.csv",
    "gastos.csv",
    "partes.csv",
    "reembolsos.csv",
    "saldos.csv",
    "sugerencias.csv",
]
EN_FILES = [
    "account.csv",
    "participants.csv",
    "expenses.csv",
    "shares.csv",
    "settlements.csv",
    "balances.csv",
    "suggestions.csv",
]


def _participant(pid: str, name: str, *, removed: bool = False) -> dict:
    return {"id": pid, "name": name, "userId": None, "removedAt": NOW if removed else None}


def _account(*names: tuple[str, str], name: str = "Vacaciones", currency: str = "ARS") -> dict:
    return {
        "_id": ObjectId("65f0a1b2c3d4e5f6a7b8c9d0"),
        "name": name,
        "description": None,
        "currency": currency,
        "participants": [_participant(pid, n) for pid, n in names],
        "isClosed": False,
        "closedAt": None,
    }


def _expense(amount: int, paid_by: str | None, participants: list[str], **extra: Any) -> dict:
    return {
        "_id": ObjectId(),
        "date": "2026-11-10",
        "title": "Cena",
        "description": None,
        "amountMinor": amount,
        "paidById": paid_by,
        "participantIds": participants,
        "categoryIcon": "food",
        **extra,
    }


def _settlement(from_id: str, to_id: str, amount: int) -> dict:
    return {
        "_id": ObjectId(),
        "date": "2026-11-11",
        "fromParticipantId": from_id,
        "toParticipantId": to_id,
        "amountMinor": amount,
    }


def _base(language: str = "es"):
    account = _account((ANA, "Ana"), (LEANDRO, "Leandro"), (JAVIER, "Javier"))
    return build_account_export(
        account,
        [_expense(9000, ANA, [ANA, LEANDRO, JAVIER])],
        [_settlement(LEANDRO, ANA, 3000)],
        language,
    )


def _unzip(content: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        return {name: archive.read(name) for name in archive.namelist()}


def _rows(raw: bytes) -> list[list[str]]:
    assert raw.startswith(codecs.BOM_UTF8)
    return list(csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline="")))


# --- CSV ------------------------------------------------------------------------------------------


@pytest.mark.parametrize(("language", "files"), [("es", ES_FILES), ("en", EN_FILES)])
def test_zip_has_the_seven_tables(language: str, files: list[str]) -> None:
    content = render_csv_zip(_base(language), language, NOW)
    assert list(_unzip(content)) == files


def test_csv_format_bom_comma_crlf_and_headers() -> None:
    raw = _unzip(render_csv_zip(_base(), "es", NOW))["gastos.csv"]
    assert raw.startswith(codecs.BOM_UTF8)
    text = raw.decode("utf-8-sig")
    assert text.endswith("\r\n")
    header, row = _rows(raw)
    assert header == [
        "ID del gasto",
        "Fecha",
        "Concepto",
        "Descripción",
        "Categoría",
        "Importe",
        "Moneda",
        "Pagó",
        "Participantes",
        "Pendiente de asignación",
    ]
    assert row[1:] == [
        "2026-11-10",
        "Cena",
        "",
        "Comida",
        "90.00",
        "ARS",
        "Ana",
        "Ana; Leandro; Javier",
        "No",
    ]


def test_english_headers_and_values() -> None:
    files = _unzip(render_csv_zip(_base("en"), "en", NOW))
    header, row = _rows(files["expenses.csv"])
    assert header[:3] == ["Expense ID", "Date", "Title"]
    assert row[4:6] == ["Food", "90.00"]
    assert row[-1] == "No"


def test_all_tables_content() -> None:
    files = _unzip(render_csv_zip(_base(), "es", NOW))
    account = _rows(files["cuenta.csv"])
    assert account[1][1:] == ["Vacaciones", "", "ARS", "No", "", "2026-11-12T14:03:09Z", "0"]
    assert [r[1:] for r in _rows(files["participantes.csv"])[1:]] == [
        ["Ana", "No"],
        ["Leandro", "No"],
        ["Javier", "No"],
    ]
    assert [r[3:] for r in _rows(files["partes.csv"])[1:]] == [
        [ANA, "Ana", "30.00", "ARS"],
        [LEANDRO, "Leandro", "30.00", "ARS"],
        [JAVIER, "Javier", "30.00", "ARS"],
    ]
    assert _rows(files["reembolsos.csv"])[1][1:] == [
        "2026-11-11",
        "Leandro",
        "Ana",
        "30.00",
        "ARS",
        "No",
    ]
    assert [r[1:] for r in _rows(files["saldos.csv"])[1:]] == [
        ["Ana", "30.00", "ARS"],
        ["Leandro", "0.00", "ARS"],
        ["Javier", "-30.00", "ARS"],
    ]
    assert _rows(files["sugerencias.csv"])[1:] == [["Javier", "Ana", "30.00", "ARS"]]


def test_empty_tables_keep_their_headers() -> None:
    account = _account((ANA, "Ana"))
    files = _unzip(render_csv_zip(build_account_export(account, [], [], "es"), "es", NOW))
    for name in ["gastos.csv", "partes.csv", "reembolsos.csv", "sugerencias.csv"]:
        assert len(_rows(files[name])) == 1


def test_currency_without_decimals() -> None:
    account = _account((ANA, "Ana"), (JAVIER, "Javier"), currency="JPY")
    export = build_account_export(account, [_expense(1500, ANA, [ANA, JAVIER])], [], "es")
    files = _unzip(render_csv_zip(export, "es", NOW))
    assert _rows(files["gastos.csv"])[1][5] == "1500"
    assert [r[2] for r in _rows(files["saldos.csv"])[1:]] == ["750", "-750"]


def test_special_characters_round_trip() -> None:
    title = 'Cena, "postre" 🍰'
    description = "Línea uno\nLínea dos; ñandú"
    account = _account((ANA, "Ana"))
    export = build_account_export(
        account, [_expense(1000, ANA, [ANA], title=title, description=description)], [], "es"
    )
    row = _rows(_unzip(render_csv_zip(export, "es", NOW))["gastos.csv"])[1]
    assert (row[2], row[3]) == (title, description)


@pytest.mark.parametrize("prefix", ["=", "+", "-", "@", "\t", "\r"])
def test_formula_injection_is_neutralized_in_user_text(prefix: str) -> None:
    evil = f"{prefix}1+1"
    account = _account((ANA, evil), (JAVIER, "Javier"), name=evil)
    account["description"] = evil
    export = build_account_export(
        account,
        [_expense(1000, ANA, [ANA, JAVIER], title=evil, description=evil)],
        [_settlement(JAVIER, ANA, 100)],
        "es",
    )
    files = _unzip(render_csv_zip(export, "es", NOW))
    safe = f"'{evil}"
    assert _rows(files["cuenta.csv"])[1][1:3] == [safe, safe]
    assert _rows(files["participantes.csv"])[1][1] == safe
    expense = _rows(files["gastos.csv"])[1]
    assert (expense[2], expense[3], expense[7]) == (safe, safe, safe)
    assert expense[8] == f"{safe}; Javier"
    assert _rows(files["partes.csv"])[1][2] == safe
    assert _rows(files["partes.csv"])[1][4] == safe
    assert _rows(files["reembolsos.csv"])[1][3] == safe
    assert _rows(files["saldos.csv"])[1][1] == safe
    assert _rows(files["sugerencias.csv"])[1][1] == safe


def test_negative_amounts_are_not_touched() -> None:
    files = _unzip(render_csv_zip(_base(), "es", NOW))
    assert _rows(files["saldos.csv"])[3][2] == "-30.00"


# --- JSON -----------------------------------------------------------------------------------------


def test_json_document() -> None:
    document = json.loads(render_json(_base(), "es", NOW))
    assert document["formatVersion"] == 1
    assert document["exportedAt"] == "2026-11-12T14:03:09Z"
    assert (document["language"], document["scope"]) == ("es", "account")
    account = document["account"]
    assert set(account) == {
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
    expense = account["expenses"][0]
    assert expense["amount"] == "90.00"
    assert expense["paidBy"] == {"id": ANA, "name": "Ana"}
    assert expense["shares"][0] == {"participant": {"id": ANA, "name": "Ana"}, "amount": "30.00"}
    assert (expense["category"], expense["categoryLabel"], expense["isPending"]) == (
        "food",
        "Comida",
        False,
    )
    assert account["settlements"][0]["from"] == {"id": LEANDRO, "name": "Leandro"}
    assert account["balances"][2] == {
        "participant": {"id": JAVIER, "name": "Javier"},
        "amount": "-30.00",
        "currency": "ARS",
    }
    assert account["suggestions"][0]["to"]["name"] == "Ana"


def test_json_keys_do_not_depend_on_language() -> None:
    spanish = json.loads(render_json(_base("es"), "es", NOW))
    english = json.loads(render_json(_base("en"), "en", NOW))

    def keys(value: Any) -> Any:
        if isinstance(value, dict):
            return {k: keys(v) for k, v in value.items()}
        if isinstance(value, list):
            return [keys(v) for v in value]
        return None

    assert keys(spanish) == keys(english)
    assert english["account"]["expenses"][0]["categoryLabel"] == "Food"


def test_json_keeps_the_original_text() -> None:
    account = _account((ANA, "=Ana"))
    export = build_account_export(account, [_expense(1000, ANA, [ANA], title="=SUM(1)")], [], "es")
    document = json.loads(render_json(export, "es", NOW))
    assert document["account"]["expenses"][0]["title"] == "=SUM(1)"
    assert document["account"]["participants"][0]["name"] == "=Ana"


def test_csv_and_json_have_the_same_rows() -> None:
    export = _base()
    files = _unzip(render_csv_zip(export, "es", NOW))
    account = json.loads(render_json(export, "es", NOW))["account"]
    pairs = {
        "participantes.csv": "participants",
        "gastos.csv": "expenses",
        "reembolsos.csv": "settlements",
        "saldos.csv": "balances",
        "sugerencias.csv": "suggestions",
    }
    for csv_name, key in pairs.items():
        assert len(_rows(files[csv_name])) - 1 == len(account[key])
    shares = sum(len(e["shares"]) for e in account["expenses"])
    assert len(_rows(files["partes.csv"])) - 1 == shares


# --- names ----------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Viaje a Bariloche", "viaje-a-bariloche"),
        ("Año Nuevo ¡2026!", "ano-nuevo-2026"),
        ("  --Ñandú & Co.--  ", "nandu-co"),
        ("🍕🍕", ""),
        ("x" * 60, "x" * 40),
    ],
)
def test_slugify(text: str, expected: str) -> None:
    assert slugify(text) == expected


def test_file_names() -> None:
    assert file_name("vacaciones", "csv", "es", NOW) == "mis-gastos_vacaciones_2026-11-12.zip"
    assert file_name("", "json", "es", NOW) == "mis-gastos_cuenta_2026-11-12.json"
    assert file_name(None, "json", "en", NOW) == "my-expenses_2026-11-12.json"
    assert file_name(None, "csv", "es", NOW) == "mis-gastos_2026-11-12.zip"


def test_content_disposition() -> None:
    value = content_disposition("mis-gastos_vacaciones_2026-11-12.zip")
    assert value == (
        'attachment; filename="mis-gastos_vacaciones_2026-11-12.zip"; '
        "filename*=UTF-8''mis-gastos_vacaciones_2026-11-12.zip"
    )


def test_account_folder_is_unique_per_account() -> None:
    account = _account((ANA, "Ana"), name="Viaje a Bariloche")
    export = build_account_export(account, [], [], "es")
    assert account_folder(export, "es") == "viaje-a-bariloche_b8c9d0"


# --- all my data (US2) ----------------------------------------------------------------------------


def _user(first_name: str = "Ana") -> dict:
    return {
        "email": "ana@mail.com",
        "firstName": first_name,
        "lastName": "Pérez",
        "preferences": {"language": "es", "defaultCurrency": "ARS", "theme": "system"},
    }


def _two_accounts() -> list[dict]:
    first = _account((ANA, "Ana"), name="Casa")
    second = _account((ANA, "Ana"), name="Casa")
    second["_id"] = ObjectId("65f0a1b2c3d4e5f6a7b8ffff")
    return [first, second]


def test_personal_zip_has_profile_and_one_folder_per_account() -> None:
    export = build_personal_export(_user(), _two_accounts(), {}, {}, "es")
    names = list(_unzip(render_csv_zip(export, "es", NOW)))
    assert names[0] == "perfil.csv"
    assert [f"casa_b8c9d0/{f}" for f in ES_FILES] == names[1:8]
    assert [f"casa_b8ffff/{f}" for f in ES_FILES] == names[8:]


def test_personal_profile_csv() -> None:
    export = build_personal_export(_user(), [], {}, {}, "es")
    files = _unzip(render_csv_zip(export, "es", NOW))
    assert list(files) == ["perfil.csv"]
    assert _rows(files["perfil.csv"]) == [
        [
            "Nombre",
            "Apellido",
            "Email",
            "Idioma",
            "Moneda por defecto",
            "Tema",
            "Exportado el (UTC)",
        ],
        ["Ana", "Pérez", "ana@mail.com", "Español", "ARS", "Sistema", "2026-11-12T14:03:09Z"],
    ]


def test_personal_profile_name_is_protected() -> None:
    export = build_personal_export(_user(first_name="=HYPERLINK(1)"), [], {}, {}, "es")
    files = _unzip(render_csv_zip(export, "es", NOW))
    assert _rows(files["perfil.csv"])[1][0] == "'=HYPERLINK(1)"


def test_personal_json() -> None:
    export = build_personal_export(_user(), _two_accounts(), {}, {}, "en")
    document = json.loads(render_json(export, "en", NOW))
    assert document["scope"] == "all"
    assert "account" not in document
    assert document["profile"] == {
        "firstName": "Ana",
        "lastName": "Pérez",
        "email": "ana@mail.com",
        "language": "es",
        "defaultCurrency": "ARS",
        "theme": "system",
    }
    assert len(document["accounts"]) == 2
