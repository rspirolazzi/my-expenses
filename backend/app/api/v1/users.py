from fastapi import APIRouter, status

from app.api.v1.dependencies import ClientDep, CurrentUserId
from app.schemas.common import Accepted, ErrorResponse
from app.schemas.user import (
    EmailChangeConfirmRequest,
    EmailChangeRequest,
    UpdateMeRequest,
    UserResponse,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])

_errors = {
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


@router.get("/me", response_model=UserResponse, responses=_errors)
async def get_me(user_id: CurrentUserId) -> UserResponse:
    return await user_service.get_me(user_id)


@router.patch("/me", response_model=UserResponse, responses=_errors)
async def update_me(
    body: UpdateMeRequest, user_id: CurrentUserId, client: ClientDep
) -> UserResponse:
    return await user_service.update_me(user_id, body, client)


@router.post(
    "/me/email-change",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=Accepted,
    responses=_errors,
)
async def request_email_change(
    body: EmailChangeRequest, user_id: CurrentUserId, client: ClientDep
) -> Accepted:
    await user_service.request_email_change(user_id, body, client)
    return Accepted()


@router.post("/me/email-change/confirm", response_model=UserResponse, responses=_errors)
async def confirm_email_change(
    body: EmailChangeConfirmRequest, user_id: CurrentUserId, client: ClientDep
) -> UserResponse:
    return await user_service.confirm_email_change(user_id, body.code, client)
