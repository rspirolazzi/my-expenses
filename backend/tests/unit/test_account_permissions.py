from datetime import UTC, datetime

import pytest
from bson import ObjectId

from app.core.errors import AppError
from app.repositories import accounts
from app.services import account_permissions as perms

OWNER = ObjectId()
MEMBER = ObjectId()
STRANGER = ObjectId()


def _account(**overrides):
    owner = accounts.new_participant("Ana", OWNER)
    member = accounts.new_participant("Leandro", MEMBER)
    free = accounts.new_participant("Javier")
    removed = accounts.new_participant("Old", ObjectId())
    removed["removedAt"] = datetime.now(UTC)
    doc = accounts.new_account_document(
        name="Viaje",
        description=None,
        icon="group",
        currency="ARS",
        owner_id=OWNER,
        participants=[owner, member, free, removed],
    )
    doc["_id"] = ObjectId()
    doc.update(overrides)
    return doc


def test_response_omits_removed_participants_and_user_ids():
    response = perms.to_account_response(_account(), MEMBER)
    names = [p.name for p in response.participants]
    assert names == ["Ana", "Leandro", "Javier"]
    dumped = response.model_dump_json()
    assert str(MEMBER) not in dumped and str(OWNER) not in dumped
    me = next(p for p in response.participants if p.is_me)
    assert me.name == "Leandro" and response.my_participant_id == me.id
    assert next(p for p in response.participants if p.is_owner).name == "Ana"
    assert response.is_owner is False


def test_summary_counts_active_participants():
    summary = perms.to_account_summary(_account(), OWNER)
    assert summary.participant_count == 3
    assert summary.is_owner is True


def test_membership_helpers():
    doc = _account()
    assert perms.is_member(doc, MEMBER)
    assert not perms.is_member(doc, STRANGER)
    assert not perms.is_member(_account(isDeleted=True), MEMBER)


def test_require_owner_and_open():
    doc = _account()
    perms.require_owner(doc, OWNER)
    with pytest.raises(AppError) as exc:
        perms.require_owner(doc, MEMBER)
    assert (exc.value.status_code, exc.value.code) == (403, "owner_only")
    perms.require_open(doc)
    with pytest.raises(AppError) as exc:
        perms.require_open(_account(isClosed=True))
    assert (exc.value.status_code, exc.value.code) == (409, "account_closed")


async def test_require_member_returns_404_for_everyone_else(db):
    doc = _account()
    doc.pop("_id")
    account_id = await accounts.insert(doc)
    assert (await perms.require_member(account_id, MEMBER))["_id"] == account_id
    for user, target in ((STRANGER, account_id), (MEMBER, ObjectId()), (MEMBER, "not-an-id")):
        with pytest.raises(AppError) as exc:
            await perms.require_member(target, user)
        assert (exc.value.status_code, exc.value.code) == (404, "not_found")
    await db.accounts.update_one({"_id": account_id}, {"$set": {"isDeleted": True}})
    with pytest.raises(AppError):
        await perms.require_member(account_id, MEMBER)
