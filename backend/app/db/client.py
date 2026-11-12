"""MongoDB client lifecycle and transaction helper (R9)."""

from collections.abc import AsyncIterator, Awaitable, Callable
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


@asynccontextmanager
async def snapshot_session() -> AsyncIterator[AsyncClientSession]:
    """Read-only session whose reads all see the same point in time (feature 005, research R3)."""
    async with get_client().start_session(snapshot=True) as session:
        yield session


async def run_in_transaction[T](callback: Callable[[AsyncClientSession], Awaitable[T]]) -> T:
    """Run `callback` in a transaction, retrying it on transient errors such as write conflicts.

    Concurrent conditional updates on the same document (e.g. two users linking the same
    participant) conflict; on retry the losing callback sees the new state and fails cleanly.
    """
    async with get_client().start_session() as session:
        return await session.with_transaction(callback)
