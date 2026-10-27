"""Job seeker profiles."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_
from sqlmodel import col, select

from app.deps import (
    CurrentJobSeekerProfile,
    CurrentJobSeekerUser,
    CurrentStaffUser,
    SessionDep,
)
from app.models import JobSeekerProfile, utcnow
from app.schemas import (
    DocumentRead,
    JobSeekerCreate,
    JobSeekerRead,
    JobSeekerUpdate,
    Page,
)
from app.services.pagination import paginate

router = APIRouter(prefix="/jobseekers", tags=["job seekers"])


@router.post("/me", response_model=JobSeekerRead, status_code=status.HTTP_201_CREATED)
def create_my_profile(
    payload: JobSeekerCreate, session: SessionDep, user: CurrentJobSeekerUser
) -> JobSeekerRead:
    existing = session.exec(
        select(JobSeekerProfile).where(JobSeekerProfile.user_id == user.id)
    ).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a profile; use PATCH to update it",
        )
    profile = JobSeekerProfile(user_id=user.id, **payload.model_dump())
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return JobSeekerRead.model_validate(profile)


@router.get("/me", response_model=JobSeekerRead)
def read_my_profile(profile: CurrentJobSeekerProfile) -> JobSeekerRead:
    return JobSeekerRead.model_validate(profile)


@router.patch("/me", response_model=JobSeekerRead)
def update_my_profile(
    payload: JobSeekerUpdate,
    session: SessionDep,
    profile: CurrentJobSeekerProfile,
) -> JobSeekerRead:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    profile.updated_at = utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return JobSeekerRead.model_validate(profile)


@router.get("/me/documents", response_model=list[DocumentRead])
def my_documents(profile: CurrentJobSeekerProfile) -> list[DocumentRead]:
    return [
        DocumentRead.model_validate(document)
        for document in sorted(
            profile.documents, key=lambda doc: doc.uploaded_at, reverse=True
        )
    ]


@router.get("", response_model=Page[JobSeekerRead])
def list_job_seekers(
    session: SessionDep,
    _: CurrentStaffUser,
    q: str | None = None,
    verified: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[JobSeekerRead]:
    """Employers and admins can browse the candidate pool."""
    statement = select(JobSeekerProfile)
    if q:
        needle = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                col(JobSeekerProfile.full_name).ilike(needle),
                col(JobSeekerProfile.skills).ilike(needle),
                col(JobSeekerProfile.headline).ilike(needle),
            )
        )
    if verified is not None:
        statement = statement.where(JobSeekerProfile.verified == verified)
    statement = statement.order_by(col(JobSeekerProfile.created_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    return Page[JobSeekerRead](
        items=[JobSeekerRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{job_seeker_id}", response_model=JobSeekerRead)
def get_job_seeker(
    job_seeker_id: int, session: SessionDep, _: CurrentStaffUser
) -> JobSeekerRead:
    profile = session.get(JobSeekerProfile, job_seeker_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job seeker not found"
        )
    return JobSeekerRead.model_validate(profile)


@router.get("/{job_seeker_id}/documents", response_model=list[DocumentRead])
def get_job_seeker_documents(
    job_seeker_id: int, session: SessionDep, _: CurrentStaffUser
) -> list[DocumentRead]:
    profile = session.get(JobSeekerProfile, job_seeker_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job seeker not found"
        )
    return [DocumentRead.model_validate(document) for document in profile.documents]
