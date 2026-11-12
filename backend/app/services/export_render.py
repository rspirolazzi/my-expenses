"""CSV (in a ZIP) and JSON rendering of exports (feature 005, research R5–R8). Pure functions.

CSV: UTF-8 with BOM, `,` separator, CRLF rows, headers in the user's language, amounts with a
decimal point. Every value a user typed (names, titles, descriptions) is protected against
spreadsheet formulas with a leading apostrophe; amounts and dates are never touched (R6).
JSON: stable camelCase keys, amounts as decimal text, the original text unchanged (R8).
"""

import codecs
import csv
import io
import json
import re
import unicodedata
import zipfile
from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import quote

from app.core.export_labels import TABLES, labels, yes_no
from app.core.i18n import Language
from app.services.export_builder import AccountExport, PersonalExport, ProfileExport, Ref

ExportFormat = Literal["csv", "json"]

FORMAT_VERSION = 1
SLUG_MAX_LENGTH = 40
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _iso(moment: datetime | None) -> str:
    if moment is None:
        return ""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _safe(text: str | None) -> str:
    """User-typed text for CSV: a leading formula character is neutralized (OWASP)."""
    if not text:
        return ""
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


# --- names ----------------------------------------------------------------------------------------


def slugify(text: str) -> str:
    """ASCII, lowercase, `-` between words, at most 40 characters; "" when nothing is left."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:SLUG_MAX_LENGTH].strip("-")


def file_name(
    slug: str | None, export_format: ExportFormat, language: Language, exported_at: datetime
) -> str:
    """`mis-gastos_<slug>_<day>.zip` for an account, `mis-gastos_<day>.zip` for everything."""
    texts = labels(language)["files"]
    extension = "zip" if export_format == "csv" else "json"
    day = exported_at.astimezone(UTC).date().isoformat()
    if slug is None:
        return f"{texts['prefix']}_{day}.{extension}"
    return f"{texts['prefix']}_{slug or texts['account_fallback']}_{day}.{extension}"


def content_disposition(name: str) -> str:
    ascii_name = name.encode("ascii", "ignore").decode("ascii").replace('"', "")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name, safe='')}"


def account_folder(account: AccountExport, language: Language) -> str:
    """Folder of an account in the "all my data" ZIP; the id suffix keeps equal names apart."""
    slug = slugify(account.name) or labels(language)["files"]["account_fallback"]
    return f"{slug}_{account.id[-6:]}"


# --- CSV ------------------------------------------------------------------------------------------


def _csv(header: list[str], rows: list[list[Any]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    writer.writerows(rows)
    return codecs.BOM_UTF8 + buffer.getvalue().encode("utf-8")


def _account_tables(
    account: AccountExport, language: Language, exported_at: datetime
) -> dict[str, bytes]:
    col = labels(language)["columns"]

    def yn(value: bool) -> str:
        return yes_no(value, language)

    def name(ref: Ref | None) -> str:
        return _safe(ref.name) if ref else ""

    tables: dict[str, tuple[list[str], list[list[Any]]]] = {
        "account": (
            [
                col["account_id"],
                col["name"],
                col["description"],
                col["currency"],
                col["closed"],
                col["closed_at"],
                col["exported_at"],
                col["pending_expenses"],
            ],
            [
                [
                    account.id,
                    _safe(account.name),
                    _safe(account.description),
                    account.currency,
                    yn(account.is_closed),
                    _iso(account.closed_at),
                    _iso(exported_at),
                    account.pending_expenses,
                ]
            ],
        ),
        "participants": (
            [col["participant_id"], col["name"], col["removed"]],
            [[p.id, _safe(p.name), yn(p.is_removed)] for p in account.participants],
        ),
        "expenses": (
            [
                col["expense_id"],
                col["date"],
                col["title"],
                col["description"],
                col["category"],
                col["amount"],
                col["currency"],
                col["paid_by"],
                col["participants"],
                col["pending"],
            ],
            [
                [
                    e.id,
                    e.date,
                    _safe(e.title),
                    _safe(e.description),
                    e.category_label,
                    e.amount,
                    e.currency,
                    name(e.paid_by),
                    "; ".join(name(s.participant) for s in e.shares),
                    yn(e.is_pending),
                ]
                for e in account.expenses
            ],
        ),
        "shares": (
            [
                col["expense_id"],
                col["date"],
                col["title"],
                col["participant_id"],
                col["participant"],
                col["share"],
                col["currency"],
            ],
            [
                [
                    e.id,
                    e.date,
                    _safe(e.title),
                    s.participant.id,
                    name(s.participant),
                    s.amount,
                    e.currency,
                ]
                for e in account.expenses
                for s in e.shares
            ],
        ),
        "settlements": (
            [
                col["settlement_id"],
                col["date"],
                col["from"],
                col["to"],
                col["amount"],
                col["currency"],
                col["excluded"],
            ],
            [
                [s.id, s.date, name(s.from_), name(s.to), s.amount, s.currency, yn(s.is_excluded)]
                for s in account.settlements
            ],
        ),
        "balances": (
            [col["participant_id"], col["participant"], col["balance"], col["currency"]],
            [
                [b.participant.id, name(b.participant), b.amount, b.currency]
                for b in account.balances
            ],
        ),
        "suggestions": (
            [col["from"], col["to"], col["amount"], col["currency"]],
            [[name(s.from_), name(s.to), s.amount, s.currency] for s in account.suggestions],
        ),
    }
    files = labels(language)["files"]
    return {files[table]: _csv(*tables[table]) for table in TABLES}


def _profile_table(profile: ProfileExport, language: Language, exported_at: datetime) -> bytes:
    col = labels(language)["columns"]
    values = labels(language)["values"]
    return _csv(
        [
            col["first_name"],
            col["last_name"],
            col["email"],
            col["language"],
            col["default_currency"],
            col["theme"],
            col["exported_at"],
        ],
        [
            [
                _safe(profile.first_name),
                _safe(profile.last_name),
                _safe(profile.email),
                values.get(f"language_{profile.language}", profile.language),
                profile.default_currency or "",
                values.get(f"theme_{profile.theme}", profile.theme),
                _iso(exported_at),
            ]
        ],
    )


def render_csv_zip(
    export: AccountExport | PersonalExport, language: Language, exported_at: datetime
) -> bytes:
    """One CSV per table; for "all my data", the profile plus one folder per account (FR-004)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        if isinstance(export, AccountExport):
            for path, content in _account_tables(export, language, exported_at).items():
                archive.writestr(path, content)
        else:
            profile_name = labels(language)["files"]["profile"]
            archive.writestr(profile_name, _profile_table(export.profile, language, exported_at))
            for account in export.accounts:
                folder = account_folder(account, language)
                for path, content in _account_tables(account, language, exported_at).items():
                    archive.writestr(f"{folder}/{path}", content)
    return buffer.getvalue()


# --- JSON -----------------------------------------------------------------------------------------


def _ref(ref: Ref | None) -> dict[str, str] | None:
    return None if ref is None else {"id": ref.id, "name": ref.name}


def _account_json(account: AccountExport) -> dict[str, Any]:
    return {
        "id": account.id,
        "name": account.name,
        "description": account.description,
        "currency": account.currency,
        "currencyDecimals": account.currency_decimals,
        "isClosed": account.is_closed,
        "closedAt": _iso(account.closed_at) or None,
        "pendingExpenses": account.pending_expenses,
        "participants": [
            {"id": p.id, "name": p.name, "isRemoved": p.is_removed} for p in account.participants
        ],
        "expenses": [
            {
                "id": e.id,
                "date": e.date,
                "title": e.title,
                "description": e.description,
                "category": e.category,
                "categoryLabel": e.category_label,
                "amount": e.amount,
                "currency": e.currency,
                "paidBy": _ref(e.paid_by),
                "isPending": e.is_pending,
                "shares": [
                    {"participant": _ref(s.participant), "amount": s.amount} for s in e.shares
                ],
            }
            for e in account.expenses
        ],
        "settlements": [
            {
                "id": s.id,
                "date": s.date,
                "from": _ref(s.from_),
                "to": _ref(s.to),
                "amount": s.amount,
                "currency": s.currency,
                "isExcluded": s.is_excluded,
            }
            for s in account.settlements
        ],
        "balances": [
            {"participant": _ref(b.participant), "amount": b.amount, "currency": b.currency}
            for b in account.balances
        ],
        "suggestions": [
            {"from": _ref(s.from_), "to": _ref(s.to), "amount": s.amount, "currency": s.currency}
            for s in account.suggestions
        ],
    }


def render_json(
    export: AccountExport | PersonalExport, language: Language, exported_at: datetime
) -> bytes:
    document: dict[str, Any] = {
        "formatVersion": FORMAT_VERSION,
        "exportedAt": _iso(exported_at),
        "language": language,
    }
    if isinstance(export, AccountExport):
        document |= {"scope": "account", "account": _account_json(export)}
    else:
        profile = export.profile
        document |= {
            "scope": "all",
            "profile": {
                "firstName": profile.first_name,
                "lastName": profile.last_name,
                "email": profile.email,
                "language": profile.language,
                "defaultCurrency": profile.default_currency,
                "theme": profile.theme,
            },
            "accounts": [_account_json(account) for account in export.accounts],
        }
    return json.dumps(document, ensure_ascii=False, indent=2).encode("utf-8")
