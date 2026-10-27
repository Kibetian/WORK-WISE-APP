"""Administrator endpoints: verification, moderation and platform stats."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import col, select

from app.deps import CurrentAdminUser, SessionDep
from app.models import (
    Application,
    Document,
    DocumentStatus,
    EmployerProfile,
    Job,
    JobSeekerProfile,
    JobStatus,
    User,
    UserRole,
)
from app.schemas import (
    AdminStats,
    DocumentAdminRead,
    DocumentReview,
    EmployerAdminRead,
    JobSeekerRead,
    Message,
    Page,
    UserAdminRead,
)
from app.services.pagination import paginate
from app.services.serializers import document_to_admin_read

router = APIRouter(prefix="/admin", tags=["admin"])


def _count(session, statement) -> int:
    return session.exec(select(func.count()).select_from(statement.subquery())).one()


@router.get("/stats", response_model=AdminStats)
def platform_stats(session: SessionDep, _: CurrentAdminUser) -> AdminStats:
    return AdminStats(
        total_users=_count(session, select(User)),
        job_seekers=_count(session, select(User).where(User.role == UserRole.JOB_SEEKER)),
        employers=_count(session, select(User).where(User.role == UserRole.EMPLOYER)),
        verified_employers=_count(
            session, select(EmployerProfile).where(EmployerProfile.verified == True)  # noqa: E712
        ),
        verified_job_seekers=_count(
            session, select(JobSeekerProfile).where(JobSeekerProfile.verified == True)  # noqa: E712
        ),
        total_jobs=_count(session, select(Job)),
        open_jobs=_count(session, select(Job).where(Job.status == JobStatus.OPEN)),
        total_applications=_count(session, select(Application)),
        pending_documents=_count(
            session, select(Document).where(Document.status == DocumentStatus.PENDING)
        ),
    )


@router.get("/users", response_model=Page[UserAdminRead])
def list_users(
    session: SessionDep,
    _: CurrentAdminUser,
    role: UserRole | None = None,
    q: str | None = None,
    is_active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[UserAdminRead]:
    statement = select(User)
    if role is not None:
        statement = statement.where(User.role == role)
    if is_active is not None:
        statement = statement.where(User.is_active == is_active)
    if q:
        needle = f"%{q.strip()}%"
        statement = statement.where(
            col(User.username).ilike(needle) | col(User.email).ilike(needle)
        )
    statement = statement.order_by(col(User.created_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)

    items: list[UserAdminRead] = []
    for user in rows:
        entry = UserAdminRead.model_validate(user)
        if user.role == UserRole.JOB_SEEKER and user.job_seeker is not None:
            entry.display_name = user.job_seeker.full_name
            entry.verified = user.job_seeker.verified
            entry.profile_id = user.job_seeker.id
        elif user.role == UserRole.EMPLOYER and user.employer is not None:
            entry.display_name = user.employer.company_name
            entry.verified = user.employer.verified
            entry.profile_id = user.employer.id
        items.append(entry)

    return Page[UserAdminRead](
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.patch("/users/{user_id}/active", response_model=Message)
def set_user_active(
    user_id: int,
    is_active: bool,
    session: SessionDep,
    admin: CurrentAdminUser,
) -> Message:
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = is_active
    session.add(user)
    session.commit()
    return Message(message="Account activated" if is_active else "Account deactivated")


@router.get("/employers", response_model=Page[EmployerAdminRead])
def list_employers(
    session: SessionDep,
    _: CurrentAdminUser,
    verified: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[EmployerAdminRead]:
    statement = select(EmployerProfile)
    if verified is not None:
        statement = statement.where(EmployerProfile.verified == verified)
    statement = statement.order_by(col(EmployerProfile.created_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    items = [
        EmployerAdminRead(
            id=profile.id,
            user_id=profile.user_id,
            company_name=profile.company_name,
            company_description=profile.company_description,
            industry=profile.industry,
            website=profile.website,
            location=profile.location,
            logo_url=profile.logo_url,
            verified=profile.verified,
            created_at=profile.created_at,
            username=profile.user.username,
            email=profile.user.email,
            job_count=len(profile.jobs),
        )
        for profile in rows
    ]
    return Page[EmployerAdminRead](
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.patch("/employers/{employer_id}/verification", response_model=Message)
def set_employer_verification(
    employer_id: int,
    verified: bool,
    session: SessionDep,
    _: CurrentAdminUser,
) -> Message:
    profile = session.get(EmployerProfile, employer_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employer not found"
        )
    profile.verified = verified
    session.add(profile)
    session.commit()
    return Message(
        message="Employer verified" if verified else "Employer verification removed"
    )


@router.get("/jobseekers", response_model=Page[JobSeekerRead])
def list_job_seekers(
    session: SessionDep,
    _: CurrentAdminUser,
    verified: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[JobSeekerRead]:
    statement = select(JobSeekerProfile)
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


@router.patch("/jobseekers/{job_seeker_id}/verification", response_model=Message)
def set_job_seeker_verification(
    job_seeker_id: int,
    verified: bool,
    session: SessionDep,
    _: CurrentAdminUser,
) -> Message:
    profile = session.get(JobSeekerProfile, job_seeker_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job seeker not found"
        )
    profile.verified = verified
    session.add(profile)
    session.commit()
    return Message(
        message="Job seeker verified" if verified else "Job seeker verification removed"
    )


@router.get("/documents", response_model=Page[DocumentAdminRead])
def list_documents(
    session: SessionDep,
    _: CurrentAdminUser,
    document_status: DocumentStatus | None = DocumentStatus.PENDING,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[DocumentAdminRead]:
    statement = select(Document)
    if document_status is not None:
        statement = statement.where(Document.status == document_status)
    statement = statement.order_by(col(Document.uploaded_at).desc())

    rows, total, pages = paginate(session, statement, page=page, page_size=page_size)
    items = [
        document_to_admin_read(document, document.job_seeker, document.job_seeker.user)
        for document in rows
    ]
    return Page[DocumentAdminRead](
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.patch("/documents/{document_id}/review", response_model=DocumentAdminRead)
def review_document(
    document_id: int,
    payload: DocumentReview,
    session: SessionDep,
    _: CurrentAdminUser,
) -> DocumentAdminRead:
    document = session.get(Document, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    document.status = payload.status
    document.review_note = payload.review_note
    session.add(document)
    session.commit()
    session.refresh(document)
    return document_to_admin_read(document, document.job_seeker, document.job_seeker.user)
