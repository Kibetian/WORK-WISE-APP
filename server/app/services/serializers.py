"""Builders that turn ORM rows into response models."""

from __future__ import annotations

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Application, Job, JobSeekerProfile, User
from app.schemas import (
    ApplicantSummary,
    ApplicationJobSummary,
    ApplicationRead,
    DocumentAdminRead,
    JobEmployerSummary,
    JobRead,
)


def application_counts(session: Session, job_ids: list[int]) -> dict[int, int]:
    if not job_ids:
        return {}
    rows = session.exec(
        select(Application.job_id, func.count(Application.id))
        .where(Application.job_id.in_(job_ids))  # type: ignore[attr-defined]
        .group_by(Application.job_id)
    ).all()
    return {job_id: count for job_id, count in rows}


def applied_job_ids(session: Session, job_seeker_id: int, job_ids: list[int]) -> set[int]:
    if not job_ids:
        return set()
    rows = session.exec(
        select(Application.job_id).where(
            Application.job_seeker_id == job_seeker_id,
            Application.job_id.in_(job_ids),  # type: ignore[attr-defined]
        )
    ).all()
    return set(rows)


def job_to_read(
    job: Job,
    *,
    application_count: int = 0,
    has_applied: bool = False,
) -> JobRead:
    return JobRead(
        id=job.id,
        title=job.title,
        description=job.description,
        requirements=job.requirements,
        location=job.location,
        employment_type=job.employment_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        status=job.status,
        created_at=job.created_at,
        employer=JobEmployerSummary(
            id=job.employer.id,
            company_name=job.employer.company_name,
            industry=job.employer.industry,
            location=job.employer.location,
            logo_url=job.employer.logo_url,
            verified=job.employer.verified,
        ),
        application_count=application_count,
        has_applied=has_applied,
    )


def jobs_to_read(
    session: Session,
    jobs: list[Job],
    *,
    viewer_job_seeker_id: int | None = None,
    include_counts: bool = True,
) -> list[JobRead]:
    job_ids = [job.id for job in jobs if job.id is not None]
    counts = application_counts(session, job_ids) if include_counts else {}
    applied = (
        applied_job_ids(session, viewer_job_seeker_id, job_ids)
        if viewer_job_seeker_id is not None
        else set()
    )
    return [
        job_to_read(
            job,
            application_count=counts.get(job.id, 0),
            has_applied=job.id in applied,
        )
        for job in jobs
    ]


def application_to_read(
    application: Application, *, include_applicant: bool = False
) -> ApplicationRead:
    job = application.job
    applicant = None
    if include_applicant:
        seeker = application.job_seeker
        applicant = ApplicantSummary(
            id=seeker.id,
            full_name=seeker.full_name,
            headline=seeker.headline,
            skills=seeker.skills,
            address=seeker.address,
            salary_expectation=seeker.salary_expectation,
            profile_image_url=seeker.profile_image_url,
            verified=seeker.verified,
        )
    return ApplicationRead(
        id=application.id,
        status=application.status,
        cover_letter=application.cover_letter,
        created_at=application.created_at,
        updated_at=application.updated_at,
        job=ApplicationJobSummary(
            id=job.id,
            title=job.title,
            location=job.location,
            employment_type=job.employment_type,
            company_name=job.employer.company_name,
        ),
        applicant=applicant,
    )


def document_to_admin_read(document, seeker: JobSeekerProfile, user: User) -> DocumentAdminRead:
    return DocumentAdminRead(
        id=document.id,
        job_seeker_id=document.job_seeker_id,
        document_type=document.document_type,
        original_name=document.original_name,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        url=document.url,
        status=document.status,
        review_note=document.review_note,
        uploaded_at=document.uploaded_at,
        job_seeker_name=seeker.full_name,
        job_seeker_email=user.email,
    )
