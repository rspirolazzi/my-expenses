from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import AppError
from app.core.security import hash_refresh_token
from app.services import token_service


async def test_issue_creates_a_new_family_with_thirty_days(db, create_user):
    user = await create_user()
    pair = await token_service.issue_token_pair(user["_id"], "web")
    doc = await db.refresh_tokens.find_one({"tokenHash": hash_refresh_token(pair.refresh_token)})
    assert doc["familyId"]
    assert pair.refresh_token not in str(doc)
    expected = datetime.now(UTC) + timedelta(days=30)
    assert abs(doc["expiresAt"] - expected) < timedelta(seconds=5)


async def test_refresh_rotates_and_slides_expiry(db, create_user):
    user = await create_user()
    first = await token_service.issue_token_pair(user["_id"], "mobile")
    await db.refresh_tokens.update_many(
        {}, {"$set": {"expiresAt": datetime.now(UTC) + timedelta(days=2)}}
    )
    second = await token_service.refresh(first.refresh_token)

    old = await db.refresh_tokens.find_one({"tokenHash": hash_refresh_token(first.refresh_token)})
    new = await db.refresh_tokens.find_one({"tokenHash": hash_refresh_token(second.refresh_token)})
    assert old["rotatedAt"] is not None
    assert new["familyId"] == old["familyId"]
    assert new["client"] == "mobile"
    assert new["expiresAt"] - datetime.now(UTC) > timedelta(days=29)


async def test_reusing_a_rotated_token_revokes_the_family(db, create_user):
    user = await create_user()
    first = await token_service.issue_token_pair(user["_id"], "web")
    second = await token_service.refresh(first.refresh_token)
    # Outside the grace period, presenting the rotated token again is treated as theft.
    await db.refresh_tokens.update_one(
        {"tokenHash": hash_refresh_token(first.refresh_token)},
        {"$set": {"rotatedAt": datetime.now(UTC) - timedelta(minutes=5)}},
    )
    with pytest.raises(AppError) as exc:
        await token_service.refresh(first.refresh_token)
    assert exc.value.code == "invalid_refresh_token"
    with pytest.raises(AppError):
        await token_service.refresh(second.refresh_token)


async def test_concurrent_refresh_within_grace_period_is_allowed(db, create_user):
    user = await create_user()
    first = await token_service.issue_token_pair(user["_id"], "web")
    a = await token_service.refresh(first.refresh_token)
    b = await token_service.refresh(first.refresh_token)
    assert a.refresh_token != b.refresh_token
    await token_service.refresh(a.refresh_token)


@pytest.mark.parametrize("field", ["revokedAt", "expiresAt"])
async def test_revoked_or_expired_token_is_rejected(db, create_user, field):
    user = await create_user()
    pair = await token_service.issue_token_pair(user["_id"], "web")
    await db.refresh_tokens.update_many(
        {}, {"$set": {field: datetime.now(UTC) - timedelta(seconds=1)}}
    )
    with pytest.raises(AppError):
        await token_service.refresh(pair.refresh_token)


async def test_unknown_token_is_rejected():
    with pytest.raises(AppError):
        await token_service.refresh("not-a-token")


async def test_revoke_other_sessions_keeps_only_the_current_family(db, create_user):
    user = await create_user()
    current = await token_service.issue_token_pair(user["_id"], "web")
    other = await token_service.issue_token_pair(user["_id"], "mobile")
    family = await token_service.family_of(current.refresh_token)
    await token_service.revoke_other_sessions(user["_id"], family)
    await token_service.refresh(current.refresh_token)
    with pytest.raises(AppError):
        await token_service.refresh(other.refresh_token)
