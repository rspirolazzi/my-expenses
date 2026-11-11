"""Readable change history of an expense, built from `audit_logs` (research R8, FR-030–FR-032).

Participant ids become names (removed participants included), amounts become decimal text and the
actor is shown by their participant name. User ids and emails are never returned.
"""

from typing import Any

from bson import ObjectId

from app.core import errors
from app.core.errors import AppError
from app.core.money import format_amount
from app.repositories import audit_logs, expenses
from app.schemas.expense import HistoryChange, HistoryEntry, ParticipantRef
from app.services.account_permissions import require_member

_ACTIONS = {
    "expense.created": "created",
    "expense.updated": "updated",
    "expense.deleted": "deleted",
}

# Stored field → field shown in the history, in display order.
_FIELDS = (
    ("date", "date"),
    ("title", "title"),
    ("amountMinor", "amount"),
    ("paidById", "paidBy"),
    ("participantIds", "participants"),
    ("categoryIcon", "categoryIcon"),
    ("description", "description"),
)


def _readable(field: str, value: Any, names: dict[str, str], currency: str) -> Any:
    if value is None:
        return None
    if field == "amountMinor":
        return format_amount(int(value), currency)
    if field == "paidById":
        return ParticipantRef(id=value, name=names.get(value, ""))
    if field == "participantIds":
        return [ParticipantRef(id=pid, name=names.get(pid, "")) for pid in value]
    return str(value)


def _changes(entry: dict[str, Any], names: dict[str, str], currency: str) -> list[HistoryChange]:
    stored = entry.get("changes") or {}
    result = []
    for source, shown in _FIELDS:
        if source not in stored:
            continue
        change = stored[source] or {}
        result.append(
            HistoryChange(
                field=shown,
                before=_readable(source, change.get("before"), names, currency),
                after=_readable(source, change.get("after"), names, currency),
            )
        )
    return result


async def history(account_id: str, expense_id: str, user_id: ObjectId) -> list[HistoryEntry]:
    account = await require_member(account_id, user_id)
    expense = await expenses.find_active(account["_id"], expense_id)
    if expense is None:
        raise AppError(404, errors.NOT_FOUND)
    names = {p["id"]: p["name"] for p in account["participants"]}
    currency = expense["currency"]
    entries = []
    for entry in await audit_logs.list_for_entity("expense", expense["_id"]):
        action = _ACTIONS.get(entry["action"])
        if action is None:
            continue
        metadata = entry.get("metadata") or {}
        actor = metadata.get("actorParticipantId")
        entries.append(
            HistoryEntry(
                id=str(entry["_id"]),
                action=action,
                actor_name=names.get(actor) if actor else None,
                reason="participant_removed"
                if metadata.get("reason") == "participant_removed"
                else None,
                at=entry["createdAt"],
                changes=_changes(entry, names, currency) if action != "deleted" else [],
            )
        )
    return entries
