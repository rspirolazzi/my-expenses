async def test_google_returns_auth_response(client, fake_google_verifier):
    token = fake_google_verifier.add("tok", sub="g-1", email="ana@gmail.com", email_verified=True)
    response = await client.post("/auth/google", json={"idToken": token})
    assert response.status_code == 200
    assert response.json()["isNewUser"] is True
    again = await client.post("/auth/google", json={"idToken": token})
    assert again.json()["isNewUser"] is False


async def test_google_rejects_invalid_tokens(client, fake_google_verifier):
    response = await client.post("/auth/google", json={"idToken": "forged"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_google_token"


async def test_google_requires_a_verified_email(client, fake_google_verifier):
    token = fake_google_verifier.add("tok", sub="g-1", email="ana@gmail.com", email_verified=False)
    response = await client.post("/auth/google", json={"idToken": token})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "google_email_not_verified"
