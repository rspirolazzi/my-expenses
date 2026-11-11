"""Opaque keyset cursor over (date, createdAt, _id), shared by expenses and settlements."""

import base64
import binascii
import json
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.core import errors
from app.core.errors import AppError


def encode_cursor(doc: dict[str, Any]) -> str:
    raw = json.dumps([doc["date"], doc["createdAt"].isoformat(), str(doc["_id"])])
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[str, datetime, ObjectId]:
    """An invalid cursor gives 422 validation_error."""
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        day, created_at, oid = json.loads(base64.urlsafe_b64decode(padded.encode()))
        return str(day), datetime.fromisoformat(created_at), ObjectId(oid)
    except (ValueError, TypeError, binascii.Error, InvalidId) as exc:
        raise AppError(422, errors.VALIDATION_ERROR) from exc


def keyset_after(after: tuple[str, datetime, ObjectId]) -> dict[str, Any]:
    """Filter for the documents strictly after `after` in (date, createdAt, _id) desc order."""
    day, created_at, oid = after
    return {
        "$or": [
            {"date": {"$lt": day}},
            {"date": day, "createdAt": {"$lt": created_at}},
            {"date": day, "createdAt": created_at, "_id": {"$lt": oid}},
        ]
    }
