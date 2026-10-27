"""Offset pagination helper shared by the list endpoints."""

from __future__ import annotations

from math import ceil
from typing import Any, TypeVar

from sqlalchemy import func
from sqlmodel import Session, select
from sqlmodel.sql.expression import SelectOfScalar

T = TypeVar("T")


def paginate(
    session: Session,
    statement: SelectOfScalar[T],
    *,
    page: int,
    page_size: int,
) -> tuple[list[T], int, int]:
    """Return ``(items, total, pages)`` for the given statement."""
    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total: int = session.exec(count_statement).one()
    pages = max(1, ceil(total / page_size)) if total else 0
    offset = (page - 1) * page_size
    items: list[Any] = list(session.exec(statement.offset(offset).limit(page_size)).all())
    return items, total, pages
