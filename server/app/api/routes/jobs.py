"""Public job board plus employer-owned job management."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_
from sqlmodel import Session, col, select

from app.deps import CurrentEmployerProfile, OptionalUser, SessionDep
from app.models import (
    EmployerProfile,
    EmploymentType,
    Job,
    JobSeekerProfile,
    JobStatus,
    User,
    UserRole,
    utcnow,
)
from app.schemas import JobCreate, JobRead, JobUpdate, Message, Page
from app.services.pagination import paginate
from app.services.serializers import job_to_read, jobs_to_read

router = APIRouter(prefix="/jobs", tags=["jobs"])


def viewer_seeker_id(session: Session, user: User | None) -> int | None:
    """The viewer's job-seeker profile id, when they have one."""
    if user is None or user.role != UserRole.JOB_SEEKER:
        return None
    profile = session.exec(
        select(JobSeekerProfile).where(JobSeekerProfile.user_id == user.id)
    ).first()
    return profile.id if profile else None


@router.get("", response_model=Page[JobRead])
def list_jobs(
    session: SessionDep,
    viewer: OptionalUser,
    q: Annotated[str | None, Query(description="Search title, description or company")] = None,
    location: str | None = None,
    employment_type: EmploymentType | None = None,
    salary_min: Annotated[float | None, Query(ge=0)] = None,
    employer_id: int | None = None,
    job_status: JobStatus | None = JobStatus.OPEN,
    sort: Annotated[
        str, Query(pattern="^(newest|oldest|salary_high|salary_low|title)$")
    ] = "newest",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 12,
) -> Page[JobRead]:
    statement = select(Job).join(EmployerProfile, col(Job.employer_id) == col(EmployerProfile.id))

    if job_status is not None:
        statement = statement.where(Job.status == job_status)
    if employer_id is not None:
        statement = statement.where(Job.employer_id == employer_id)
    if q:
        needle = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                col(Job.title).ilike(needle),
                col(Job.description).ilike(needle),
                col(Job.requirements).ilike(needle),
                col(EmployerProfile.company_name).ilike(needle),
            )
        )
    if location:
        statement = statement.where(col(Job.location).ilike(f"%{location.strip()}%"))
    if employment_type is not None:
        statement = statement.where(Job.employment_type == employment_type)
    if salary_min is not None:
        statement = statement.where(
            or_(col(Job.salary_max) >= salary_min, col(Job.salary_min) >= salary_min)
        )

    orderings = {
        "newest": col(Job.created_at).desc(),
        "oldest": col(Job.created_at).asc(),
        "salary_high": col(Job.salary_max).desc(),
        "salary_low": col(Job.salary_min).asc(),
        "title": col(Job.title).asc(),
    }
    statement = statement.order_by(orderings[sort], col(Job.id).desc())

    jobs, total, pages = paginate(session, statement, page=page, page_size=page_size)
    items = jobs_to_read(
        session, list(jobs), viewer_job_seeker_id=viewer_seeker_id(session, viewer)
    )
    return Page[JobRead](items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, session: SessionDep, viewer: OptionalUser) -> JobRead:
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return jobs_to_read(
        session, [job], viewer_job_seeker_id=viewer_seeker_id(session, viewer)
    )[0]


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: JobCreate, session: SessionDep, employer: CurrentEmployerProfile
) -> JobRead:
    if not employer.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your company profile must be verified by an administrator "
                "before you can post jobs"
            ),
        )
    job = Job(employer_id=employer.id, **payload.model_dump())
    session.add(job)
    session.commit()
    session.refresh(job)
    return job_to_read(job, application_count=0)


@router.patch("/{job_id}", response_model=JobRead)
def update_job(
    job_id: int,
    payload: JobUpdate,
    session: SessionDep,
    employer: CurrentEmployerProfile,
) -> JobRead:
    job = session.get(Job, job_id)
    if job is None or job.employer_id != employer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    updates = payload.model_dump(exclude_unset=True)
    salary_min = updates.get("salary_min", job.salary_min)
    salary_max = updates.get("salary_max", job.salary_max)
    if salary_min is not None and salary_max is not None and salary_max < salary_min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="salary_max must be greater than or equal to salary_min",
        )

    for key, value in updates.items():
        setattr(job, key, value)
    job.updated_at = utcnow()
    session.add(job)
    session.commit()
    session.refresh(job)
    return jobs_to_read(session, [job])[0]


@router.delete("/{job_id}", response_model=Message)
def delete_job(job_id: int, session: SessionDep, employer: CurrentEmployerProfile) -> Message:
    job = session.get(Job, job_id)
    if job is None or job.employer_id != employer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    session.delete(job)
    session.commit()
    return Message(message="Job deleted")
