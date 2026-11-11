from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.v1.dependencies import ClientDep, CurrentUserId
from app.schemas.common import ErrorResponse
from app.schemas.expense import PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX
from app.schemas.settlement import SettlementCreate, SettlementPage, SettlementResponse
from app.services import settlement_service

router = APIRouter(prefix="/accounts/{account_id}/settlements", tags=["settlements"])

_errors = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}


@router.get("", response_model=SettlementPage, responses=_errors)
async def list_settlements(
    account_id: str,
    user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
    cursor: Annotated[str | None, Query(max_length=512)] = None,
) -> SettlementPage:
    return await settlement_service.list_settlements(account_id, user_id, limit, cursor)


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=SettlementResponse, responses=_errors
)
async def create_settlement(
    account_id: str, body: SettlementCreate, user_id: CurrentUserId, client: ClientDep
) -> SettlementResponse:
    return await settlement_service.create_settlement(account_id, user_id, body, client)


@router.delete(
    "/{settlement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=_errors,
)
async def delete_settlement(
    account_id: str, settlement_id: str, user_id: CurrentUserId, client: ClientDep
) -> Response:
    await settlement_service.delete_settlement(account_id, settlement_id, user_id, client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
