from fastapi import APIRouter, Response, status

from app.api.v1.dependencies import ClientDep, CurrentUserId
from app.schemas.account import (
    AccountCreate,
    AccountResponse,
    AccountSummary,
    AccountUpdate,
    ParticipantName,
)
from app.schemas.common import ErrorResponse
from app.schemas.expense import ParticipantImpact
from app.services import account_service

router = APIRouter(prefix="/accounts", tags=["accounts"])

_errors = {
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}


@router.get("", response_model=list[AccountSummary], responses=_errors)
async def list_accounts(user_id: CurrentUserId) -> list[AccountSummary]:
    return await account_service.list_my_accounts(user_id)


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=AccountResponse, responses=_errors
)
async def create_account(
    body: AccountCreate, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await account_service.create_account(user_id, body, client)


@router.get("/{account_id}", response_model=AccountResponse, responses=_errors)
async def get_account(account_id: str, user_id: CurrentUserId) -> AccountResponse:
    return await account_service.get_account(account_id, user_id)


@router.patch("/{account_id}", response_model=AccountResponse, responses=_errors)
async def update_account(
    account_id: str, body: AccountUpdate, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await account_service.update_account(account_id, user_id, body, client)


@router.post(
    "/{account_id}/participants",
    status_code=status.HTTP_201_CREATED,
    response_model=AccountResponse,
    responses=_errors,
)
async def add_participant(
    account_id: str, body: ParticipantName, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await account_service.add_participant(account_id, user_id, body.name, client)


@router.patch(
    "/{account_id}/participants/{participant_id}",
    response_model=AccountResponse,
    responses=_errors,
)
async def rename_participant(
    account_id: str,
    participant_id: str,
    body: ParticipantName,
    user_id: CurrentUserId,
    client: ClientDep,
) -> AccountResponse:
    return await account_service.rename_participant(
        account_id, user_id, participant_id, body.name, client
    )


@router.get(
    "/{account_id}/participants/{participant_id}/impact",
    response_model=ParticipantImpact,
    responses=_errors,
)
async def participant_impact(
    account_id: str, participant_id: str, user_id: CurrentUserId
) -> ParticipantImpact:
    return await account_service.participant_impact(account_id, user_id, participant_id)


@router.delete(
    "/{account_id}/participants/{participant_id}",
    response_model=AccountResponse,
    responses=_errors,
)
async def remove_participant(
    account_id: str, participant_id: str, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await account_service.remove_participant(account_id, user_id, participant_id, client)


@router.post(
    "/{account_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=_errors,
)
async def leave_account(account_id: str, user_id: CurrentUserId, client: ClientDep) -> Response:
    await account_service.leave_account(account_id, user_id, client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{account_id}/invite-code", response_model=AccountResponse, responses=_errors)
async def regenerate_invite_code(
    account_id: str, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await account_service.regenerate_invite_code(account_id, user_id, client)


@router.post("/{account_id}/close", response_model=AccountResponse, responses=_errors)
async def close_account(
    account_id: str, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await account_service.close_account(account_id, user_id, client)


@router.delete(
    "/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=_errors,
)
async def delete_account(account_id: str, user_id: CurrentUserId, client: ClientDep) -> Response:
    await account_service.delete_account(account_id, user_id, client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
