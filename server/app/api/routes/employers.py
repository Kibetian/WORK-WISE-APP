"""Employer company profiles and their own job listings."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_
from sqlmodel import col, select

from app.deps import (
    CurrentEmployerProfile,
    CurrentEmployerUser,
    SessionDep,
)
from app.models import EmployerProfile, Job, JobStatus, utcnow
from app.schemas import (
    EmployerCreate,
    EmployerRead,
    EmployerUpdate,
    JobRead,
    Page,
)
from app.services.pagination import paginate
from app.services.serializers import jobs_to_read

router = APIRouter(prefix="/employers", tags=["employers"])


@router.post("/me", response_model=EmployerRead, status_code=status.HTTP_201_CREATED)
def create_my_company(
    payload: EmployerCreate, session: SessionDep, user: CurrentEmployerUser
) -> EmployerRead:
    existing = session.exec(
        select(EmployerProfile).where(EmployerProfile.user_id == user.id)
    ).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a company profile; use PATCH to update it",
        )
    profile = EmployerProfile(user_id=user.id, **payload.model_dump())
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return EmployerRead.model_validate(profile)


@router.get("/me", response_model=EmployerRead)
def read_my_company(profile: CurrentEmployerProfile) -> EmployerRead:
    return EmployerRead.model_validate(profile)


@router.patch("/me", response_model=EmployerRead)
def update_my_company(
    payload: EmployerUpdate,
    session: SessionDep,
    profile: CurrentEmployerProfile,
) -> EmployerRead:
    # ``verified`` is deliberately absent from EmployerUpdate: only an admin
    # may set it. The original app let an employer verify themselves.
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    profile.updated_at = utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return EmployerRead.model_validate(profile)


@router.get("/me/jobs", response_model=Page[JobRead])
def my_jobs(
    session: SessionDep,
    employer: CurrentEmployerProfile,
    job_status: JobStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[JobRead]:
    statement = select(Job).where(Job.employer_id == employer.id)
    if job_status is not None:
        statement = statement.where(Job.status == job_status)
    statement = statement.order_by(col(Job.created_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    return Page[JobRead](
        items=jobs_to_read(session, list(rows)),
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("", response_model=Page[EmployerRead])
def list_employers(
    session: SessionDep,
    q: str | None = None,
    verified: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[EmployerRead]:
    """Public directory of hiring companies."""
    statement = select(EmployerProfile)
    if q:
        needle = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                col(EmployerProfile.company_name).ilike(needle),
                col(EmployerProfile.industry).ilike(needle),
            )
        )
    if verified is not None:
        statement = statement.where(EmployerProfile.verified == verified)
    statement = statement.order_by(col(EmployerProfile.company_name).asc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    return Page[EmployerRead](
        items=[EmployerRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{employer_id}", response_model=EmployerRead)
def get_employer(employer_id: int, session: SessionDep) -> EmployerRead:
    profile = session.get(EmployerProfile, employer_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employer not found"
        )
    return EmployerRead.model_validate(profile)
