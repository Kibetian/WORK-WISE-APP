"""Test fixtures: an isolated in-memory database per test."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

os.environ.setdefault("SECRET_KEY", "test-secret-key")
# Keep the application engine off disk; every test gets its own session anyway.
os.environ.setdefault("DATABASE_URL", "sqlite://")

from app.core.config import settings  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import UserRole  # noqa: E402


@pytest.fixture(name="upload_dir")
def upload_dir_fixture() -> Generator[Path, None, None]:
    with TemporaryDirectory() as tmp:
        original = settings.UPLOAD_DIR
        settings.UPLOAD_DIR = Path(tmp)
        yield Path(tmp)
        settings.UPLOAD_DIR = original


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(session: Session, upload_dir: Path) -> Generator[TestClient, None, None]:
    app = create_app()

    def _get_session_override() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[get_session] = _get_session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def register(
    client: TestClient,
    *,
    username: str,
    email: str,
    password: str = "password123",
    role: UserRole | str = UserRole.JOB_SEEKER,
) -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "role": role.value if isinstance(role, UserRole) else role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="seeker")
def seeker_fixture(client: TestClient) -> dict:
    """A job seeker with a completed profile. Returns token + profile."""
    token = register(
        client, username="seeker", email="seeker@example.com", role=UserRole.JOB_SEEKER
    )["access_token"]
    profile = client.post(
        "/api/jobseekers/me",
        json={"full_name": "Sam Seeker", "skills": "Python, SQL"},
        headers=auth_header(token),
    )
    assert profile.status_code == 201, profile.text
    return {"token": token, "profile": profile.json()}


@pytest.fixture(name="admin")
def admin_fixture(client: TestClient, session: Session) -> dict:
    """An administrator. Admins cannot self-register, so insert directly."""
    from app.core.security import hash_password
    from app.models import User

    user = User(
        username="root",
        email="root@example.com",
        hashed_password=hash_password("password123"),
        role=UserRole.ADMIN,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    response = client.post(
        "/api/auth/login",
        json={"email": "root@example.com", "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return {"token": response.json()["access_token"], "user": response.json()["user"]}


@pytest.fixture(name="employer")
def employer_fixture(client: TestClient, admin: dict) -> dict:
    """A verified employer with a company profile, ready to post jobs."""
    token = register(
        client, username="acme", email="hiring@acme.test", role=UserRole.EMPLOYER
    )["access_token"]
    company = client.post(
        "/api/employers/me",
        json={"company_name": "Acme Corp", "industry": "Widgets"},
        headers=auth_header(token),
    )
    assert company.status_code == 201, company.text
    employer_id = company.json()["id"]

    verified = client.patch(
        f"/api/admin/employers/{employer_id}/verification",
        params={"verified": True},
        headers=auth_header(admin["token"]),
    )
    assert verified.status_code == 200, verified.text
    return {"token": token, "profile": company.json(), "id": employer_id}


def create_job(client: TestClient, employer_token: str, **overrides) -> dict:
    payload = {
        "title": "Backend Engineer",
        "description": "Build and run the services behind our product.",
        "requirements": "Python, SQL",
        "location": "Remote",
        "employment_type": "full_time",
        "salary_min": 80000,
        "salary_max": 120000,
    }
    payload.update(overrides)
    response = client.post("/api/jobs", json=payload, headers=auth_header(employer_token))
    assert response.status_code == 201, response.text
    return response.json()
