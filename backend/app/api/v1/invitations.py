from fastapi import APIRouter

from app.api.v1.dependencies import ClientDep, CurrentUserId
from app.schemas.account import AcceptInvitation, AccountResponse, InvitationPreview
from app.schemas.common import ErrorResponse
from app.services import invitation_service

router = APIRouter(prefix="/invitations", tags=["invitations"])

_errors = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}


@router.get("/{code}", response_model=InvitationPreview, responses=_errors)
async def preview_invitation(code: str, user_id: CurrentUserId) -> InvitationPreview:
    return await invitation_service.preview(code, user_id)


@router.post("/{code}/accept", response_model=AccountResponse, responses=_errors)
async def accept_invitation(
    code: str, body: AcceptInvitation, user_id: CurrentUserId, client: ClientDep
) -> AccountResponse:
    return await invitation_service.accept(code, user_id, body, client)
