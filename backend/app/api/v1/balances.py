from fastapi import APIRouter

from app.api.v1.dependencies import CurrentUserId
from app.schemas.common import ErrorResponse
from app.schemas.settlement import AccountBalances
from app.services import balance_service

router = APIRouter(prefix="/accounts/{account_id}/balances", tags=["balances"])

_errors = {401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}}


@router.get("", response_model=AccountBalances, responses=_errors)
async def get_balances(account_id: str, user_id: CurrentUserId) -> AccountBalances:
    return await balance_service.get_account_balances(account_id, user_id)
