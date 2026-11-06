from typing import Annotated, Literal

import jwt
from bson import ObjectId
from fastapi import Depends, Header

from app.core import errors
from app.core.errors import AppError
from app.core.i18n import Language, resolve_language
from app.core.security import decode_access_token
from app.repositories import users

Client = Literal["web", "mobile"]


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> ObjectId:
    """Validate the Bearer JWT (signature, iss, aud, exp) and that the user still exists."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, errors.UNAUTHORIZED)
    token = authorization[7:].strip()
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise AppError(401, errors.UNAUTHORIZED) from exc
    user_id = users.to_object_id(payload["sub"])
    if user_id is None or await users.find_by_id(user_id) is None:
        raise AppError(401, errors.UNAUTHORIZED)
    return user_id


def get_client(x_client: Annotated[str | None, Header()] = None) -> Client:
    return "mobile" if (x_client or "").strip().lower() == "mobile" else "web"


def get_language(accept_language: Annotated[str | None, Header()] = None) -> Language:
    return resolve_language(accept_language)


CurrentUserId = Annotated[ObjectId, Depends(get_current_user_id)]
ClientDep = Annotated[Client, Depends(get_client)]
LanguageDep = Annotated[Language, Depends(get_language)]
