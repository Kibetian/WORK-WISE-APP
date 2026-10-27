"""Applying for jobs, and the employer's applicant pipeline."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import col, select

from app.deps import (
    CurrentEmployerProfile,
    CurrentJobSeekerProfile,
    SessionDep,
)
from app.models import Application, ApplicationStatus, Job, JobStatus, utcnow
from app.schemas import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationStatusUpdate,
    Message,
    Page,
)
from app.services.pagination import paginate
from app.services.serializers import application_to_read

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def apply_to_job(
    payload: ApplicationCreate,
    session: SessionDep,
    seeker: CurrentJobSeekerProfile,
) -> ApplicationRead:
    job = session.get(Job, payload.job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != JobStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This job is no longer accepting applications",
        )

    existing = session.exec(
        select(Application).where(
            Application.job_id == job.id,
            Application.job_seeker_id == seeker.id,
        )
    ).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job",
        )

    application = Application(
        job_id=job.id,
        job_seeker_id=seeker.id,
        cover_letter=payload.cover_letter,
        status=ApplicationStatus.APPLIED,
    )
    session.add(application)
    session.commit()
    session.refresh(application)
    return application_to_read(application)


@router.get("/me", response_model=Page[ApplicationRead])
def my_applications(
    session: SessionDep,
    seeker: CurrentJobSeekerProfile,
    application_status: ApplicationStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[ApplicationRead]:
    statement = select(Application).where(Application.job_seeker_id == seeker.id)
    if application_status is not None:
        statement = statement.where(Application.status == application_status)
    statement = statement.order_by(col(Application.created_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    return Page[ApplicationRead](
        items=[application_to_read(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.delete("/{application_id}", response_model=Message)
def withdraw_application(
    application_id: int,
    session: SessionDep,
    seeker: CurrentJobSeekerProfile,
) -> Message:
    application = session.get(Application, application_id)
    if application is None or application.job_seeker_id != seeker.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    session.delete(application)
    session.commit()
    return Message(message="Application withdrawn")


@router.get("/received", response_model=Page[ApplicationRead])
def received_applications(
    session: SessionDep,
    employer: CurrentEmployerProfile,
    job_id: int | None = None,
    application_status: ApplicationStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[ApplicationRead]:
    statement = (
        select(Application)
        .join(Job, col(Application.job_id) == col(Job.id))
        .where(Job.employer_id == employer.id)
    )
    if job_id is not None:
        statement = statement.where(Application.job_id == job_id)
    if application_status is not None:
        statement = statement.where(Application.status == application_status)
    statement = statement.order_by(col(Application.created_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    return Page[ApplicationRead](
        items=[application_to_read(row, include_applicant=True) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.patch("/{application_id}/status", response_model=ApplicationRead)
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    session: SessionDep,
    employer: CurrentEmployerProfile,
) -> ApplicationRead:
    application = session.get(Application, application_id)
    if application is None or application.job.employer_id != employer.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    application.status = payload.status
    application.updated_at = utcnow()
    session.add(application)
    session.commit()
    session.refresh(application)
    return application_to_read(application, include_applicant=True)
