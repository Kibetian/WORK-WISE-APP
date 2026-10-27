"""Request and response models.

Kept separate from the table models so the API surface never leaks a password
hash or an internal column by accident.
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    ApplicationStatus,
    DocumentStatus,
    DocumentType,
    EmploymentType,
    JobStatus,
    UserRole,
)

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------
# Pagination
# --------------------------------------------------------------------------
class Page(ORMModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class Message(BaseModel):
    message: str


# --------------------------------------------------------------------------
# Auth / users
# --------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.JOB_SEEKER

    @field_validator("role")
    @classmethod
    def _no_self_service_admin(cls, value: UserRole) -> UserRole:
        if value == UserRole.ADMIN:
            raise ValueError("Admin accounts cannot be self-registered")
        return value

    @field_validator("username")
    @classmethod
    def _strip_username(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Username cannot be blank")
        return cleaned


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(ORMModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class AuthenticatedUser(ORMModel):
    """``/auth/me`` -- the user plus whichever profile matches their role."""

    user: UserRead
    job_seeker_profile: "JobSeekerRead | None" = None
    employer_profile: "EmployerRead | None" = None


# --------------------------------------------------------------------------
# Job seeker profile
# --------------------------------------------------------------------------
class JobSeekerBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    headline: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=160)
    salary_expectation: float | None = Field(default=None, ge=0)
    summary: str | None = None
    skills: str | None = Field(default=None, max_length=500)
    education: str | None = None
    experience: str | None = None


class JobSeekerCreate(JobSeekerBase):
    pass


class JobSeekerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    headline: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=160)
    salary_expectation: float | None = Field(default=None, ge=0)
    summary: str | None = None
    skills: str | None = Field(default=None, max_length=500)
    education: str | None = None
    experience: str | None = None


class JobSeekerRead(ORMModel):
    id: int
    user_id: int
    full_name: str
    headline: str | None
    phone: str | None
    address: str | None
    salary_expectation: float | None
    summary: str | None
    skills: str | None
    education: str | None
    experience: str | None
    profile_image_url: str | None
    verified: bool
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------
# Employer profile
# --------------------------------------------------------------------------
class EmployerBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    company_description: str | None = None
    industry: str | None = Field(default=None, max_length=80)
    website: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=160)


class EmployerCreate(EmployerBase):
    pass


class EmployerUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=120)
    company_description: str | None = None
    industry: str | None = Field(default=None, max_length=80)
    website: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=160)


class EmployerRead(ORMModel):
    id: int
    user_id: int
    company_name: str
    company_description: str | None
    industry: str | None
    website: str | None
    location: str | None
    logo_url: str | None
    verified: bool
    created_at: datetime


class EmployerAdminRead(EmployerRead):
    username: str
    email: EmailStr
    job_count: int


# --------------------------------------------------------------------------
# Jobs
# --------------------------------------------------------------------------
class JobBase(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10)
    requirements: str | None = None
    location: str | None = Field(default=None, max_length=160)
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)

    @field_validator("salary_max")
    @classmethod
    def _check_salary_range(cls, value: float | None, info) -> float | None:
        minimum = info.data.get("salary_min")
        if value is not None and minimum is not None and value < minimum:
            raise ValueError("salary_max must be greater than or equal to salary_min")
        return value


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    description: str | None = Field(default=None, min_length=10)
    requirements: str | None = None
    location: str | None = Field(default=None, max_length=160)
    employment_type: EmploymentType | None = None
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    status: JobStatus | None = None


class JobEmployerSummary(ORMModel):
    id: int
    company_name: str
    industry: str | None
    location: str | None
    logo_url: str | None
    verified: bool


class JobRead(ORMModel):
    id: int
    title: str
    description: str
    requirements: str | None
    location: str | None
    employment_type: EmploymentType
    salary_min: float | None
    salary_max: float | None
    status: JobStatus
    created_at: datetime
    employer: JobEmployerSummary
    application_count: int = 0
    has_applied: bool = False


# --------------------------------------------------------------------------
# Applications
# --------------------------------------------------------------------------
class ApplicationCreate(BaseModel):
    job_id: int
    cover_letter: str | None = Field(default=None, max_length=5000)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ApplicationJobSummary(ORMModel):
    id: int
    title: str
    location: str | None
    employment_type: EmploymentType
    company_name: str


class ApplicantSummary(ORMModel):
    id: int
    full_name: str
    headline: str | None
    skills: str | None
    address: str | None
    salary_expectation: float | None
    profile_image_url: str | None
    verified: bool


class ApplicationRead(ORMModel):
    id: int
    status: ApplicationStatus
    cover_letter: str | None
    created_at: datetime
    updated_at: datetime
    job: ApplicationJobSummary
    applicant: ApplicantSummary | None = None


# --------------------------------------------------------------------------
# Documents
# --------------------------------------------------------------------------
class DocumentRead(ORMModel):
    id: int
    job_seeker_id: int
    document_type: DocumentType
    original_name: str
    content_type: str
    size_bytes: int
    url: str
    status: DocumentStatus
    review_note: str | None
    uploaded_at: datetime


class DocumentAdminRead(DocumentRead):
    job_seeker_name: str
    job_seeker_email: EmailStr


class DocumentReview(BaseModel):
    status: DocumentStatus
    review_note: str | None = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def _must_be_decision(cls, value: DocumentStatus) -> DocumentStatus:
        if value == DocumentStatus.PENDING:
            raise ValueError("Review status must be 'approved' or 'rejected'")
        return value


class UploadRead(BaseModel):
    url: str
    message: str


# --------------------------------------------------------------------------
# Admin
# --------------------------------------------------------------------------
class AdminStats(BaseModel):
    total_users: int
    job_seekers: int
    employers: int
    verified_employers: int
    verified_job_seekers: int
    total_jobs: int
    open_jobs: int
    total_applications: int
    pending_documents: int


class UserAdminRead(UserRead):
    display_name: str | None = None
    verified: bool | None = None
    profile_id: int | None = None


AuthenticatedUser.model_rebuild()
