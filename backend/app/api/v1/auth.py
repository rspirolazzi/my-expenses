from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.v1.dependencies import ClientDep, LanguageDep
from app.schemas.auth import (
    AuthResponse,
    GoogleLoginRequest,
    LoginCodeRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    ResendRegistrationRequest,
    TokenPair,
    VerifyCodeRequest,
)
from app.schemas.common import Accepted, ErrorResponse
from app.services import auth_service, token_service
from app.services.google_service import GoogleVerifier, get_google_verifier

router = APIRouter(prefix="/auth", tags=["auth"])

_errors = {
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


@router.post(
    "/register", status_code=status.HTTP_202_ACCEPTED, response_model=Accepted, responses=_errors
)
async def register(body: RegisterRequest) -> Accepted:
    await auth_service.register(body)
    return Accepted()


@router.post(
    "/register/resend",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=Accepted,
    responses=_errors,
)
async def resend_registration(body: ResendRegistrationRequest) -> Accepted:
    await auth_service.resend_registration(body.email)
    return Accepted()


@router.post(
    "/register/verify",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthResponse,
    responses=_errors,
)
async def verify_registration(body: VerifyCodeRequest, client: ClientDep) -> AuthResponse:
    return await auth_service.verify_registration(body.email, body.code, client)


@router.post(
    "/login",
    response_model=AuthResponse,
    responses={**_errors, 423: {"model": ErrorResponse}},
)
async def login(body: LoginRequest, client: ClientDep) -> AuthResponse:
    return await auth_service.login_password(body.email, body.password, client)


@router.post(
    "/login-code", status_code=status.HTTP_202_ACCEPTED, response_model=Accepted, responses=_errors
)
async def request_login_code(body: LoginCodeRequest) -> Accepted:
    await auth_service.request_login_code(body.email)
    return Accepted()


@router.post("/login-code/verify", response_model=AuthResponse, responses=_errors)
async def verify_login_code(body: VerifyCodeRequest, client: ClientDep) -> AuthResponse:
    return await auth_service.verify_login_code(body.email, body.code, client)


@router.post(
    "/google",
    response_model=AuthResponse,
    responses={**_errors, 403: {"model": ErrorResponse}},
)
async def google_login(
    body: GoogleLoginRequest,
    client: ClientDep,
    language: LanguageDep,
    verifier: Annotated[GoogleVerifier, Depends(get_google_verifier)],
) -> AuthResponse:
    return await auth_service.login_with_google(body.id_token, client, language, verifier)


@router.post(
    "/password-reset",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=Accepted,
    responses=_errors,
)
async def request_password_reset(body: PasswordResetRequest) -> Accepted:
    await auth_service.request_password_reset(body.email)
    return Accepted()


@router.post("/password-reset/confirm", response_model=AuthResponse, responses=_errors)
async def confirm_password_reset(
    body: PasswordResetConfirmRequest, client: ClientDep
) -> AuthResponse:
    return await auth_service.confirm_password_reset(
        body.email, body.code, body.new_password, client
    )


@router.post("/refresh", response_model=TokenPair, responses=_errors)
async def refresh(body: RefreshRequest) -> TokenPair:
    return await token_service.refresh(body.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(body: LogoutRequest, client: ClientDep) -> Response:
    await auth_service.logout(body.refresh_token, client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
