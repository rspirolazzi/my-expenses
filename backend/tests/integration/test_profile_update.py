from tests.conftest import auth_headers


async def test_profile_changes_persist_and_are_audited_once(client, db, create_user):
    user = await create_user(email="ana@mail.com")
    response = await client.patch(
        "/users/me",
        json={
            "firstName": "Ana",
            "preferences": {"language": "en", "theme": "dark", "defaultCurrency": "EUR"},
        },
        headers=auth_headers(user["_id"]),
    )
    assert response.status_code == 200

    entries = [doc async for doc in db.audit_logs.find({"action": "user.profile_updated"})]
    assert len(entries) == 1
    assert entries[0]["changes"]["preferences.theme"] == {"before": "system", "after": "dark"}
    assert entries[0]["changes"]["firstName"] == {"before": None, "after": "Ana"}

    # Another device signing in gets the same preferences (SC-005).
    login = await client.post(
        "/auth/login", json={"email": "ana@mail.com", "password": "correct-password"}
    )
    assert login.json()["user"]["preferences"] == {
        "language": "en",
        "defaultCurrency": "EUR",
        "theme": "dark",
    }


async def test_unchanged_values_are_not_audited(client, db, create_user):
    user = await create_user()
    await client.patch(
        "/users/me", json={"preferences": {"theme": "system"}}, headers=auth_headers(user["_id"])
    )
    assert await db.audit_logs.count_documents({}) == 0
