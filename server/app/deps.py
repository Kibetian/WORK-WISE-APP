"""Shared FastAPI dependencies: authentication and role gates."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.security import decode_access_token
from app.db import get_session
from app.models import EmployerProfile, JobSeekerProfile, User, UserRole

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

SessionDep = Annotated[Session, Depends(get_session)]

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> User:
    if credentials is None or not credentials.credentials:
        raise _CREDENTIALS_ERROR

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise _CREDENTIALS_ERROR

    subject = payload.get("sub")
    if subject is None:
        raise _CREDENTIALS_ERROR

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise _CREDENTIALS_ERROR from None

    user = session.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Dependency factory restricting an endpoint to the given roles."""

    allowed = set(roles)

    def _guard(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return _guard


CurrentJobSeekerUser = Annotated[User, Depends(require_roles(UserRole.JOB_SEEKER))]
CurrentEmployerUser = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]
CurrentAdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
CurrentStaffUser = Annotated[User, Depends(require_roles(UserRole.EMPLOYER, UserRole.ADMIN))]


def get_job_seeker_profile(session: SessionDep, user: CurrentJobSeekerUser) -> JobSeekerProfile:
    profile = session.exec(
        select(JobSeekerProfile).where(JobSeekerProfile.user_id == user.id)
    ).first()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create your job seeker profile first",
        )
    return profile


def get_employer_profile(session: SessionDep, user: CurrentEmployerUser) -> EmployerProfile:
    profile = session.exec(
        select(EmployerProfile).where(EmployerProfile.user_id == user.id)
    ).first()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create your company profile first",
        )
    return profile


CurrentJobSeekerProfile = Annotated[JobSeekerProfile, Depends(get_job_seeker_profile)]
CurrentEmployerProfile = Annotated[EmployerProfile, Depends(get_employer_profile)]


def get_optional_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> User | None:
    """Like ``get_current_user`` but returns ``None`` instead of raising.

    Used by public endpoints that show extra detail to a signed-in visitor
    (for example, whether they have already applied to a job).
    """
    if credentials is None or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None
    subject = payload.get("sub")
    if subject is None:
        return None
    try:
        user = session.get(User, int(subject))
    except (TypeError, ValueError):
        return None
    if user is None or not user.is_active:
        return None
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
