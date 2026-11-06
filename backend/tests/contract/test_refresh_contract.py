from datetime import UTC, datetime, timedelta

from app.core.security import hash_refresh_token
from app.services import token_service

TOKEN_FIELDS = {"accessToken", "accessTokenExpiresAt", "refreshToken", "refreshTokenExpiresAt"}


async def test_refresh_returns_a_rotated_pair(client, create_user):
    user = await create_user()
    pair = await token_service.issue_token_pair(user["_id"], "web")
    response = await client.post("/auth/refresh", json={"refreshToken": pair.refresh_token})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == TOKEN_FIELDS
    assert body["refreshToken"] != pair.refresh_token


async def test_refresh_rejects_unknown_revoked_and_reused_tokens(client, db, create_user):
    response = await client.post("/auth/refresh", json={"refreshToken": "unknown"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"

    user = await create_user()
    pair = await token_service.issue_token_pair(user["_id"], "web")
    await client.post("/auth/refresh", json={"refreshToken": pair.refresh_token})
    await db.refresh_tokens.update_one(
        {"tokenHash": hash_refresh_token(pair.refresh_token)},
        {"$set": {"rotatedAt": datetime.now(UTC) - timedelta(minutes=5)}},
    )
    response = await client.post("/auth/refresh", json={"refreshToken": pair.refresh_token})
    assert response.status_code == 401

    revoked = await token_service.issue_token_pair(user["_id"], "web")
    await db.refresh_tokens.update_many({}, {"$set": {"revokedAt": datetime.now(UTC)}})
    response = await client.post("/auth/refresh", json={"refreshToken": revoked.refresh_token})
    assert response.status_code == 401
