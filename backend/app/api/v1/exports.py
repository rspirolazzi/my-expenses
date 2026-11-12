"""Data export endpoints (feature 005, contracts/api.md): the file is the whole response."""

from typing import Annotated, Any

from fastapi import APIRouter, Query, Response

from app.api.v1.dependencies import CurrentUserId, LanguageDep
from app.schemas.common import ErrorResponse
from app.services import export_service
from app.services.export_render import ExportFormat, content_disposition
from app.services.export_service import ExportFile

router = APIRouter(tags=["exports"])

FormatQuery = Annotated[ExportFormat, Query(alias="format", description="csv (ZIP) or json")]

_file: dict[int | str, dict[str, Any]] = {
    200: {
        "description": "The exported file (attachment).",
        "content": {
            "application/zip": {"schema": {"type": "string", "format": "binary"}},
            "application/json": {"schema": {"type": "object"}},
        },
    },
    401: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}


def _response(file: ExportFile) -> Response:
    return Response(
        content=file.content,
        media_type=file.media_type,
        headers={
            "Content-Disposition": content_disposition(file.file_name),
            "Cache-Control": "no-store",
        },
    )


@router.get(
    "/accounts/{account_id}/export",
    response_class=Response,
    responses={**_file, 404: {"model": ErrorResponse}},
)
async def export_account(
    account_id: str, user_id: CurrentUserId, language: LanguageDep, export_format: FormatQuery
) -> Response:
    return _response(
        await export_service.export_account(account_id, user_id, export_format, language)
    )


@router.get("/users/me/export", response_class=Response, responses=_file)
async def export_mine(
    user_id: CurrentUserId, language: LanguageDep, export_format: FormatQuery
) -> Response:
    return _response(await export_service.export_mine(user_id, export_format, language))
