"""Access JWT + rotating opaque refresh token with sliding 30-day expiry (R1)."""

import uuid
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.core import errors
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token, generate_refresh_token, hash_refresh_token
from app.repositories import refresh_tokens, users
from app.schemas.auth import TokenPair

# A rotated token presented again within this window is treated as a concurrent refresh from the
# same client (e.g. parallel requests), not as theft: a new pair is issued in the same family.
REUSE_GRACE_PERIOD = timedelta(seconds=60)


async def issue_token_pair(
    user_id: ObjectId,
    client: str,
    family_id: str | None = None,
    session: AsyncClientSession | None = None,
) -> TokenPair:
    access_token, access_expires_at = create_access_token(str(user_id))
    refresh_token = generate_refresh_token()
    refresh_expires_at = datetime.now(UTC) + timedelta(
        days=get_settings().refresh_token_expire_days
    )
    await refresh_tokens.insert(
        user_id=user_id,
        family_id=family_id or str(uuid.uuid4()),
        token_hash=hash_refresh_token(refresh_token),
        client=client,
        expires_at=refresh_expires_at,
        session=session,
    )
    return TokenPair(
        access_token=access_token,
        access_token_expires_at=access_expires_at,
        refresh_token=refresh_token,
        refresh_token_expires_at=refresh_expires_at,
    )


async def refresh(refresh_token: str) -> TokenPair:
    doc = await refresh_tokens.find_by_hash(hash_refresh_token(refresh_token))
    now = datetime.now(UTC)
    if doc is None or doc["revokedAt"] is not None or doc["expiresAt"] <= now:
        raise AppError(401, errors.INVALID_REFRESH_TOKEN)

    if doc["rotatedAt"] is not None:
        if now - doc["rotatedAt"] > REUSE_GRACE_PERIOD:
            await refresh_tokens.revoke_family(doc["familyId"])
            raise AppError(401, errors.INVALID_REFRESH_TOKEN)
    elif not await refresh_tokens.mark_rotated(doc["_id"]):
        # Another request rotated it a moment ago; fall through within the grace period.
        current = await refresh_tokens.find_by_hash(doc["tokenHash"])
        if current is None or current["revokedAt"] is not None:
            raise AppError(401, errors.INVALID_REFRESH_TOKEN)

    if await users.find_by_id(doc["userId"]) is None:
        await refresh_tokens.revoke_family(doc["familyId"])
        raise AppError(401, errors.INVALID_REFRESH_TOKEN)

    return await issue_token_pair(doc["userId"], doc["client"], family_id=doc["familyId"])


async def family_of(refresh_token: str) -> str | None:
    doc = await refresh_tokens.find_by_hash(hash_refresh_token(refresh_token))
    return doc["familyId"] if doc else None


async def revoke_other_sessions(
    user_id: ObjectId, current_family_id: str | None, session: AsyncClientSession | None = None
) -> None:
    await refresh_tokens.revoke_all_for_user(
        user_id, except_family_id=current_family_id, session=session
    )
