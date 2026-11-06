from tests.conftest import actions


async def _google(client, token, language="es"):
    return await client.post(
        "/auth/google", json={"idToken": token}, headers={"Accept-Language": language}
    )


async def test_new_account_is_created_from_google_claims(client, db, fake_google_verifier):
    token = fake_google_verifier.add(
        "t",
        sub="g-1",
        email="Ana@Gmail.com",
        email_verified=True,
        given_name="Ana",
        family_name="García",
    )
    response = await _google(client, token, language="en-US")
    assert response.status_code == 200
    assert response.json()["isNewUser"] is True
    user = await db.users.find_one({})
    assert user["email"] == "ana@gmail.com"
    assert user["authProviders"] == ["google"]
    assert user["googleSubject"] == "g-1"
    assert user["passwordHash"] is None
    assert (user["firstName"], user["lastName"]) == ("Ana", "García")
    assert user["preferences"]["language"] == "en"
    assert await actions(db, user["_id"]) == ["user.registered", "user.login_succeeded"]


async def test_missing_names_fall_back_to_null(client, db, fake_google_verifier):
    token = fake_google_verifier.add("t", sub="g-1", email="ana@gmail.com", email_verified=True)
    await _google(client, token)
    user = await db.users.find_one({})
    assert (user["firstName"], user["lastName"]) == (None, None)


async def test_returning_user_is_not_duplicated(client, db, fake_google_verifier):
    token = fake_google_verifier.add("t", sub="g-1", email="ana@gmail.com", email_verified=True)
    await _google(client, token)
    await _google(client, token)
    assert await db.users.count_documents({}) == 1


async def test_existing_password_user_is_linked(
    client, db, create_user, fake_google_verifier, email_outbox
):
    user = await create_user(email="ana@mail.com", language="en")
    token = fake_google_verifier.add("t", sub="g-1", email="ana@mail.com", email_verified=True)
    response = await _google(client, token)
    assert response.json()["isNewUser"] is False
    linked = await db.users.find_one({"_id": user["_id"]})
    assert sorted(linked["authProviders"]) == ["email", "google"]
    assert linked["googleSubject"] == "g-1"
    assert await db.users.count_documents({}) == 1
    assert "user.google_linked" in await actions(db, user["_id"])
    assert [(e.template, e.language) for e in email_outbox] == [("security_google_linked", "en")]


async def test_unverified_google_email_does_not_link_or_create(
    client, db, create_user, fake_google_verifier
):
    await create_user(email="ana@mail.com")
    token = fake_google_verifier.add("t", sub="g-1", email="ana@mail.com", email_verified=False)
    assert (await _google(client, token)).status_code == 403
    user = await db.users.find_one({})
    assert user["googleSubject"] is None
    assert await db.users.count_documents({}) == 1


async def test_google_subject_is_never_reassigned(client, db, create_user, fake_google_verifier):
    await create_user(email="ana@mail.com", google_subject="g-original")
    token = fake_google_verifier.add("t", sub="g-other", email="ana@mail.com", email_verified=True)
    assert (await _google(client, token)).status_code == 401
    assert (await db.users.find_one({}))["googleSubject"] == "g-original"
