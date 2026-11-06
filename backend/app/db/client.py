"""MongoDB client lifecycle and transaction helper (R9)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from pymongo import AsyncMongoClient
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings

_client: AsyncMongoClient | None = None


async def connect() -> AsyncMongoClient:
    global _client
    if _client is None:
        _client = AsyncMongoClient(get_settings().mongodb_connection_uri, tz_aware=True)
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


def get_client() -> AsyncMongoClient:
    if _client is None:
        raise RuntimeError("MongoDB client is not connected")
    return _client


def get_database() -> AsyncDatabase:
    return get_client()[get_settings().database_name]


@asynccontextmanager
async def transaction() -> AsyncIterator[AsyncClientSession]:
    """Run the enclosed writes atomically; commits on success and aborts on any exception."""
    async with get_client().start_session() as session:
        async with await session.start_transaction():
            yield session
