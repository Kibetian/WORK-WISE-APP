"""Database models.

One module keeps the relationship graph easy to follow. SQLModel classes are
the persistence layer only -- request/response shapes live in ``app.schemas``.

NOTE: this module deliberately does NOT use ``from __future__ import
annotations``. Under PEP 563 every annotation becomes a plain string, and
SQLModel resolves a relationship's target by inspecting the annotation object.
Given a string it cannot reduce to a bare class name it passes the whole text
to SQLAlchemy as the target class, which then fails at mapper-configuration
time with "failed to locate a name". Keeping real typing objects here means
``Optional["JobSeekerProfile"]`` and ``List["Application"]`` reduce correctly
to ``JobSeekerProfile`` and ``Application``. Do not add the future import.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    JOB_SEEKER = "job_seeker"
    EMPLOYER = "employer"
    ADMIN = "admin"


class JobStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    TEMPORARY = "temporary"


class ApplicationStatus(str, Enum):
    APPLIED = "applied"
    REVIEWING = "reviewing"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    HIRED = "hired"


class DocumentType(str, Enum):
    RESUME = "resume"
    COVER_LETTER = "cover_letter"
    CERTIFICATE = "certificate"
    OTHER = "other"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True, max_length=255)
    username: str = Field(index=True, unique=True, max_length=80)
    hashed_password: str = Field(max_length=255)
    role: UserRole = Field(default=UserRole.JOB_SEEKER, index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)

    job_seeker: Optional["JobSeekerProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    employer: Optional["EmployerProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )


class JobSeekerProfile(SQLModel, table=True):
    __tablename__ = "job_seeker_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    full_name: str = Field(max_length=120)
    headline: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    address: Optional[str] = Field(default=None, max_length=160)
    salary_expectation: Optional[float] = Field(default=None, ge=0)
    summary: Optional[str] = Field(default=None)
    skills: Optional[str] = Field(default=None, max_length=500)
    education: Optional[str] = Field(default=None)
    experience: Optional[str] = Field(default=None)
    profile_image_url: Optional[str] = Field(default=None, max_length=500)
    verified: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    user: Optional[User] = Relationship(back_populates="job_seeker")
    applications: List["Application"] = Relationship(
        back_populates="job_seeker",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    documents: List["Document"] = Relationship(
        back_populates="job_seeker",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class EmployerProfile(SQLModel, table=True):
    __tablename__ = "employer_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    company_name: str = Field(max_length=120, index=True)
    company_description: Optional[str] = Field(default=None)
    industry: Optional[str] = Field(default=None, max_length=80)
    website: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=160)
    logo_url: Optional[str] = Field(default=None, max_length=500)
    verified: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    user: Optional[User] = Relationship(back_populates="employer")
    jobs: List["Job"] = Relationship(
        back_populates="employer",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    employer_id: int = Field(foreign_key="employer_profiles.id", index=True)
    title: str = Field(max_length=140, index=True)
    description: str
    requirements: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default=None, max_length=160, index=True)
    employment_type: EmploymentType = Field(default=EmploymentType.FULL_TIME, index=True)
    salary_min: Optional[float] = Field(default=None, ge=0)
    salary_max: Optional[float] = Field(default=None, ge=0)
    status: JobStatus = Field(default=JobStatus.OPEN, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)

    employer: Optional[EmployerProfile] = Relationship(back_populates="jobs")
    applications: List["Application"] = Relationship(
        back_populates="job",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Application(SQLModel, table=True):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("job_id", "job_seeker_id", name="uq_application_job_seeker"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="jobs.id", index=True)
    job_seeker_id: int = Field(foreign_key="job_seeker_profiles.id", index=True)
    status: ApplicationStatus = Field(default=ApplicationStatus.APPLIED, index=True)
    cover_letter: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)

    job: Optional[Job] = Relationship(back_populates="applications")
    job_seeker: Optional[JobSeekerProfile] = Relationship(back_populates="applications")


class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: Optional[int] = Field(default=None, primary_key=True)
    job_seeker_id: int = Field(foreign_key="job_seeker_profiles.id", index=True)
    document_type: DocumentType = Field(default=DocumentType.RESUME, index=True)
    original_name: str = Field(max_length=255)
    stored_name: str = Field(max_length=255, unique=True)
    content_type: str = Field(max_length=120)
    size_bytes: int = Field(default=0, ge=0)
    url: str = Field(max_length=500)
    status: DocumentStatus = Field(default=DocumentStatus.PENDING, index=True)
    review_note: Optional[str] = Field(default=None, max_length=500)
    uploaded_at: datetime = Field(default_factory=utcnow, index=True)

    job_seeker: Optional[JobSeekerProfile] = Relationship(back_populates="documents")
