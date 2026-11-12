"""Data export (feature 005): permissions, one consistent read, rendering and audit.

Everything is read inside one snapshot session (research R3), so balances always match the
exported expenses. The audit entry is written only after the file was built (R10). Nothing of the
exported content goes to the application logs (FR-016).
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.core import errors
from app.core.errors import AppError
from app.core.i18n import Language
from app.db.client import snapshot_session
from app.repositories import accounts, expenses, settlements, users
from app.services import audit_service
from app.services.export_builder import build_account_export, build_personal_export
from app.services.export_render import (
    ExportFormat,
    file_name,
    render_csv_zip,
    render_json,
    slugify,
)

MEDIA_TYPES: dict[ExportFormat, str] = {
    "csv": "application/zip",
    "json": "application/json; charset=utf-8",
}


@dataclass(frozen=True)
class ExportFile:
    content: bytes
    media_type: str
    file_name: str


def _render(export: Any, export_format: ExportFormat, language: Language, at: datetime) -> bytes:
    if export_format == "csv":
        return render_csv_zip(export, language, at)
    return render_json(export, language, at)


async def export_account(
    account_id: str, user_id: ObjectId, export_format: ExportFormat, language: Language
) -> ExportFile:
    """One account, open or closed, for any member; 404 to everyone else (FR-001, FR-014)."""
    async with snapshot_session() as session:
        account = await accounts.find_for_member(account_id, user_id, session=session)
        if account is None:
            raise AppError(404, errors.NOT_FOUND)
        expense_docs = await expenses.active_for_export([account["_id"]], session)
        settlement_docs = await settlements.active_for_export([account["_id"]], session)
    exported_at = datetime.now(UTC)
    export = build_account_export(account, expense_docs, settlement_docs, language)
    content = _render(export, export_format, language, exported_at)
    await audit_service.record(
        "account.exported",
        actor_user_id=user_id,
        entity_id=account["_id"],
        entity_type="account",
        account_id=account["_id"],
        metadata={"format": export_format},
    )
    return ExportFile(
        content=content,
        media_type=MEDIA_TYPES[export_format],
        file_name=file_name(slugify(account["name"]), export_format, language, exported_at),
    )


async def export_mine(
    user_id: ObjectId, export_format: ExportFormat, language: Language
) -> ExportFile:
    """The profile plus every account the user is a member of, in three queries (US2, R11)."""
    async with snapshot_session() as session:
        user = await users.find_by_id(user_id, session=session)
        if user is None:
            raise AppError(401, errors.UNAUTHORIZED)
        member_of = await accounts.list_for_member(user_id, session=session)
        ids = [doc["_id"] for doc in member_of]
        expenses_by_account: dict[ObjectId, list[dict[str, Any]]] = defaultdict(list)
        settlements_by_account: dict[ObjectId, list[dict[str, Any]]] = defaultdict(list)
        if ids:
            for doc in await expenses.active_for_export(ids, session):
                expenses_by_account[doc["accountId"]].append(doc)
            for doc in await settlements.active_for_export(ids, session):
                settlements_by_account[doc["accountId"]].append(doc)
    exported_at = datetime.now(UTC)
    export = build_personal_export(
        user, member_of, expenses_by_account, settlements_by_account, language
    )
    content = _render(export, export_format, language, exported_at)
    await audit_service.record(
        "user.data_exported",
        actor_user_id=user_id,
        entity_id=user_id,
        metadata={"format": export_format, "accountCount": len(member_of)},
    )
    return ExportFile(
        content=content,
        media_type=MEDIA_TYPES[export_format],
        file_name=file_name(None, export_format, language, exported_at),
    )
