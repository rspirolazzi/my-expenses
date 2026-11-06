from app.core.security import hash_refresh_token
from app.services import token_service
from tests.conftest import actions


async def test_logout_revokes_only_the_current_session(client, db, create_user):
    user = await create_user()
    current = await token_service.issue_token_pair(user["_id"], "web")
    other = await token_service.issue_token_pair(user["_id"], "mobile")

    response = await client.post("/auth/logout", json={"refreshToken": current.refresh_token})
    assert response.status_code == 204
    doc = await db.refresh_tokens.find_one({"tokenHash": hash_refresh_token(current.refresh_token)})
    assert doc["revokedAt"] is not None
    assert (
        await client.post("/auth/refresh", json={"refreshToken": current.refresh_token})
    ).status_code == 401
    assert (
        await client.post("/auth/refresh", json={"refreshToken": other.refresh_token})
    ).status_code == 200
    assert await actions(db, user["_id"]) == ["user.logged_out"]


async def test_logout_is_idempotent(client, create_user):
    user = await create_user()
    pair = await token_service.issue_token_pair(user["_id"], "web")
    for token in (pair.refresh_token, pair.refresh_token, "unknown-token"):
        response = await client.post("/auth/logout", json={"refreshToken": token})
        assert response.status_code == 204
