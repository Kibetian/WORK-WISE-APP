"""Registration, login and the current-user endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import CurrentUser, SessionDep
from app.models import EmployerProfile, JobSeekerProfile, User
from app.schemas import (
    AuthenticatedUser,
    EmployerRead,
    JobSeekerRead,
    Message,
    PasswordChange,
    Token,
    UserCreate,
    UserLogin,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token(user: User) -> Token:
    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


def _authenticate(session: Session, email: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email.lower().strip())).first()
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )
    return user


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, session: SessionDep) -> Token:
    email = payload.email.lower().strip()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )
    if session.exec(select(User).where(User.username == payload.username)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That username is already taken"
        )

    user = User(
        username=payload.username,
        email=email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _issue_token(user)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, session: SessionDep) -> Token:
    user = _authenticate(session, payload.email, payload.password)
    return _issue_token(user)


@router.post("/token", response_model=Token, include_in_schema=True)
def login_form(
    session: SessionDep,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    """OAuth2 password flow, so the interactive docs can authorise requests."""
    user = _authenticate(session, form.username, form.password)
    return _issue_token(user)


@router.get("/me", response_model=AuthenticatedUser)
def read_me(session: SessionDep, user: CurrentUser) -> AuthenticatedUser:
    seeker = session.exec(
        select(JobSeekerProfile).where(JobSeekerProfile.user_id == user.id)
    ).first()
    employer = session.exec(
        select(EmployerProfile).where(EmployerProfile.user_id == user.id)
    ).first()
    return AuthenticatedUser(
        user=UserRead.model_validate(user),
        job_seeker_profile=JobSeekerRead.model_validate(seeker) if seeker else None,
        employer_profile=EmployerRead.model_validate(employer) if employer else None,
    )


@router.post("/change-password", response_model=Message)
def change_password(
    payload: PasswordChange, session: SessionDep, user: CurrentUser
) -> Message:
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your current password is incorrect",
        )
    user.hashed_password = hash_password(payload.new_password)
    session.add(user)
    session.commit()
    return Message(message="Password updated")


@router.post("/logout", response_model=Message)
def logout(_: CurrentUser) -> Message:
    """Tokens are stateless; the client discards it. Kept for symmetry."""
    return Message(message="Signed out")
