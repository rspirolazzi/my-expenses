from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model whose JSON uses camelCase, as required by the API contract."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorBody(CamelModel):
    code: str
    message: str
    retry_after_seconds: int | None = None


class ErrorResponse(CamelModel):
    error: ErrorBody


class Accepted(CamelModel):
    status: Literal["accepted"] = "accepted"
