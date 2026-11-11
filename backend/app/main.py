import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import accounts, auth, balances, expenses, invitations, settlements, users
from app.core import errors
from app.core.errors import AppError
from app.core.i18n import error_message, resolve_language
from app.db import client as mongo
from app.db.indexes import ensure_indexes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await mongo.connect()
    await ensure_indexes(mongo.get_database())
    yield
    await mongo.close()


def _error_response(
    request: Request,
    status_code: int,
    code: str,
    retry_after: int | None = None,
    extra: dict | None = None,
):
    language = resolve_language(request.headers.get("accept-language"))
    body: dict = {"error": {"code": code, "message": error_message(code, language)}}
    headers: dict[str, str] = {}
    if retry_after is not None:
        body["error"]["retryAfterSeconds"] = retry_after
        headers["Retry-After"] = str(retry_after)
    if extra:
        body.update(extra)
    return JSONResponse(status_code=status_code, content=body, headers=headers)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mis Gastos API",
        version="1.0.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return _error_response(
            request, exc.status_code, exc.code, exc.retry_after_seconds, exc.extra
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, _: RequestValidationError):
        # Field details are omitted on purpose: they would echo user input (passwords included).
        return _error_response(request, 422, errors.VALIDATION_ERROR)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code = errors.NOT_FOUND if exc.status_code == 404 else errors.INTERNAL_ERROR
        return _error_response(request, exc.status_code, code)

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        logger.exception("Unhandled error: %s", type(exc).__name__)
        return _error_response(request, 500, errors.INTERNAL_ERROR)

    api = APIRouter(prefix="/api/v1")
    api.include_router(auth.router)
    api.include_router(users.router)
    api.include_router(accounts.router)
    api.include_router(expenses.router)
    api.include_router(balances.router)
    api.include_router(settlements.router)
    api.include_router(invitations.router)
    app.include_router(api)
    return app


app = create_app()
