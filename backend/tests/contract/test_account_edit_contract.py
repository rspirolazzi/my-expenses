from tests.conftest import auth_headers, participant_id


async def test_patch_account(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    url = f"/accounts/{account['_id']}"
    headers = auth_headers(owner["_id"])

    response = await client.patch(
        url, json={"name": "Brasil", "description": "Enero", "icon": "beach"}, headers=headers
    )
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["icon"]) == ("Brasil", "beach")

    cleared = await client.patch(url, json={"description": None}, headers=headers)
    assert cleared.json()["description"] is None
    assert cleared.json()["name"] == "Brasil"

    currency = await client.patch(url, json={"currency": "USD"}, headers=headers)
    assert currency.status_code == 422


async def test_participant_endpoints(client, create_user, create_account):
    owner = await create_user()
    account = await create_account(owner)
    base = f"/accounts/{account['_id']}/participants"
    headers = auth_headers(owner["_id"])

    added = await client.post(base, json={"name": "Martina"}, headers=headers)
    assert added.status_code == 201
    martina = next(p["id"] for p in added.json()["participants"] if p["name"] == "Martina")

    renamed = await client.patch(f"{base}/{martina}", json={"name": "Marti"}, headers=headers)
    assert renamed.status_code == 200
    assert any(p["name"] == "Marti" for p in renamed.json()["participants"])

    duplicate = await client.post(base, json={"name": " JAVIER "}, headers=headers)
    assert (duplicate.status_code, duplicate.json()["error"]["code"]) == (
        422,
        "duplicate_participant_name",
    )

    removed = await client.delete(f"{base}/{martina}", headers=headers)
    assert removed.status_code == 200
    assert all(p["id"] != martina for p in removed.json()["participants"])
    again = await client.delete(f"{base}/{martina}", headers=headers)
    assert again.status_code == 404

    owner_participant = participant_id(account, "Ana")
    protected = await client.delete(f"{base}/{owner_participant}", headers=headers)
    assert (protected.status_code, protected.json()["error"]["code"]) == (409, "owner_participant")


async def test_non_members_get_404(client, create_user, create_account):
    owner = await create_user()
    stranger = await create_user(email="stranger@mail.com")
    account = await create_account(owner)
    headers = auth_headers(stranger["_id"])
    javier = participant_id(account, "Javier")
    responses = [
        await client.patch(f"/accounts/{account['_id']}", json={"name": "X"}, headers=headers),
        await client.post(
            f"/accounts/{account['_id']}/participants", json={"name": "X"}, headers=headers
        ),
        await client.delete(f"/accounts/{account['_id']}/participants/{javier}", headers=headers),
    ]
    assert {r.status_code for r in responses} == {404}
