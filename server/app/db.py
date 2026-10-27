"""Database engine and session management."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.engine import Engine
from sqlalchemy.orm import configure_mappers
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings


def _engine_kwargs(url: str) -> dict:
    kwargs: dict = {"echo": settings.SQL_ECHO, "pool_pre_ping": True}
    if url.startswith("sqlite"):
        # FastAPI serves requests from a thread pool; SQLite needs this.
        kwargs["connect_args"] = {"check_same_thread": False}
        kwargs.pop("pool_pre_ping")
    return kwargs


engine: Engine = create_engine(settings.DATABASE_URL, **_engine_kwargs(settings.DATABASE_URL))


def init_db() -> None:
    """Create any missing tables. Import models first so they are registered."""
    import app.models  # noqa: F401  (registers tables on SQLModel.metadata)

    # Resolve every relationship now rather than lazily on the first query.
    # A bad relationship annotation otherwise surfaces as a 500 on whichever
    # endpoint happens to be hit first; here it stops the server at boot with
    # the offending mapper named.
    configure_mappers()

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
