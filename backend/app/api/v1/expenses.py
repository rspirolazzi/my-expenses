from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.v1.dependencies import ClientDep, CurrentUserId
from app.schemas.common import ErrorResponse
from app.schemas.expense import (
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
    ExpenseCreate,
    ExpensePage,
    ExpenseResponse,
    ExpenseUpdate,
    HistoryEntry,
)
from app.services import expense_history, expense_service

router = APIRouter(prefix="/accounts/{account_id}/expenses", tags=["expenses"])

_errors = {
    401: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}


@router.get("", response_model=ExpensePage, responses=_errors)
async def list_expenses(
    account_id: str,
    user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
    cursor: Annotated[str | None, Query(max_length=512)] = None,
) -> ExpensePage:
    return await expense_service.list_expenses(account_id, user_id, limit, cursor)


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=ExpenseResponse, responses=_errors
)
async def create_expense(
    account_id: str, body: ExpenseCreate, user_id: CurrentUserId, client: ClientDep
) -> ExpenseResponse:
    return await expense_service.create_expense(account_id, user_id, body, client)


@router.get("/{expense_id}", response_model=ExpenseResponse, responses=_errors)
async def get_expense(account_id: str, expense_id: str, user_id: CurrentUserId) -> ExpenseResponse:
    return await expense_service.get_expense(account_id, expense_id, user_id)


@router.put("/{expense_id}", response_model=ExpenseResponse, responses=_errors)
async def update_expense(
    account_id: str,
    expense_id: str,
    body: ExpenseUpdate,
    user_id: CurrentUserId,
    client: ClientDep,
) -> ExpenseResponse:
    return await expense_service.update_expense(account_id, expense_id, user_id, body, client)


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=_errors,
)
async def delete_expense(
    account_id: str,
    expense_id: str,
    version: Annotated[int, Query(ge=1)],
    user_id: CurrentUserId,
    client: ClientDep,
) -> Response:
    await expense_service.delete_expense(account_id, expense_id, user_id, version, client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{expense_id}/history", response_model=list[HistoryEntry], responses=_errors)
async def expense_history_entries(
    account_id: str, expense_id: str, user_id: CurrentUserId
) -> list[HistoryEntry]:
    return await expense_history.history(account_id, expense_id, user_id)
