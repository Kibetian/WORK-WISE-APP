"""Populate the database with demo accounts and sample data.

    python seed.py            # add demo data, keeping anything already there
    python seed.py --reset    # drop every table first, then seed

Demo logins (password shown next to each):

    admin@workwise.dev        / admin1234     administrator
    hiring@northwind.dev      / employer1234  employer, verified
    talent@lumenlabs.dev      / employer1234  employer, awaiting verification
    ada@example.com           / seeker1234    job seeker, verified
    grace@example.com         / seeker1234    job seeker
"""

from __future__ import annotations

import argparse
from datetime import timedelta

from sqlmodel import Session, SQLModel, select

from app.core.security import hash_password
from app.db import engine, init_db
from app.models import (
    Application,
    ApplicationStatus,
    Document,
    DocumentStatus,
    DocumentType,
    EmployerProfile,
    EmploymentType,
    Job,
    JobSeekerProfile,
    JobStatus,
    User,
    UserRole,
    utcnow,
)

ADMIN_PASSWORD = "admin1234"
EMPLOYER_PASSWORD = "employer1234"
SEEKER_PASSWORD = "seeker1234"


def _user(session: Session, *, username: str, email: str, password: str, role: UserRole) -> User:
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        return existing
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    session.add(user)
    session.flush()
    return user


def seed(reset: bool = False) -> None:
    if reset:
        import app.models  # noqa: F401

        SQLModel.metadata.drop_all(engine)
    init_db()

    with Session(engine) as session:
        if session.exec(select(Job)).first() is not None and not reset:
            print("Database already contains jobs; nothing to do. Use --reset to rebuild.")
            return

        _user(
            session,
            username="admin",
            email="admin@workwise.dev",
            password=ADMIN_PASSWORD,
            role=UserRole.ADMIN,
        )

        northwind_user = _user(
            session,
            username="northwind",
            email="hiring@northwind.dev",
            password=EMPLOYER_PASSWORD,
            role=UserRole.EMPLOYER,
        )
        lumen_user = _user(
            session,
            username="lumenlabs",
            email="talent@lumenlabs.dev",
            password=EMPLOYER_PASSWORD,
            role=UserRole.EMPLOYER,
        )

        ada_user = _user(
            session,
            username="ada",
            email="ada@example.com",
            password=SEEKER_PASSWORD,
            role=UserRole.JOB_SEEKER,
        )
        grace_user = _user(
            session,
            username="grace",
            email="grace@example.com",
            password=SEEKER_PASSWORD,
            role=UserRole.JOB_SEEKER,
        )

        northwind = EmployerProfile(
            user_id=northwind_user.id,
            company_name="Northwind Systems",
            company_description=(
                "We build logistics software used by freight operators across the "
                "country. Small teams, long-lived products, no on-call heroics."
            ),
            industry="Logistics software",
            website="https://northwind.example",
            location="Brisbane, AU",
            verified=True,
        )
        lumen = EmployerProfile(
            user_id=lumen_user.id,
            company_name="Lumen Labs",
            company_description=(
                "An early-stage studio working on measurement tooling for clinical "
                "trials. Four engineers, one designer, a lot of whiteboards."
            ),
            industry="Health technology",
            website="https://lumenlabs.example",
            location="Remote",
            verified=False,
        )
        session.add_all([northwind, lumen])
        session.flush()

        ada = JobSeekerProfile(
            user_id=ada_user.id,
            full_name="Ada Mwangi",
            headline="Backend engineer, Python and Go",
            phone="+254 700 000 001",
            address="Nairobi, KE",
            salary_expectation=95000,
            summary=(
                "Six years building payment and scheduling systems. I like work that "
                "involves careful data modelling and unglamorous reliability."
            ),
            skills="Python, FastAPI, PostgreSQL, Go, Docker, Terraform",
            education="BSc Computer Science, University of Nairobi",
            experience=(
                "Senior Engineer at Kesho Pay (2021-present) - rebuilt the settlement "
                "pipeline.\nEngineer at Twiga (2018-2021) - order routing services."
            ),
            verified=True,
        )
        grace = JobSeekerProfile(
            user_id=grace_user.id,
            full_name="Grace Otieno",
            headline="Front-end engineer with a design background",
            phone="+254 700 000 002",
            address="Mombasa, KE",
            salary_expectation=82000,
            summary=(
                "I came to engineering from product design, so I care about the "
                "seams: empty states, loading, keyboard access."
            ),
            skills="TypeScript, React, Vite, Tailwind CSS, Accessibility, Figma",
            education="BA Design, Technical University of Mombasa",
            experience=(
                "Front-end Engineer at Sanduku (2022-present).\n"
                "Product Designer at Baraza (2019-2022)."
            ),
            verified=False,
        )
        session.add_all([ada, grace])
        session.flush()

        jobs = [
            Job(
                employer_id=northwind.id,
                title="Senior Backend Engineer",
                description=(
                    "Own the services behind our shipment tracking product. You will "
                    "work on the data model, the public API and the batch jobs that "
                    "reconcile carrier feeds overnight."
                ),
                requirements=(
                    "Five years with Python or Go; comfortable with SQL beyond the ORM; "
                    "experience running services you wrote."
                ),
                location="Brisbane, AU",
                employment_type=EmploymentType.FULL_TIME,
                salary_min=110000,
                salary_max=140000,
                created_at=utcnow() - timedelta(days=2),
            ),
            Job(
                employer_id=northwind.id,
                title="Platform Engineer (Contract)",
                description=(
                    "Six-month engagement to move our deployment pipeline off the "
                    "bespoke scripts it grew into and onto something a new hire can read."
                ),
                requirements="Terraform, AWS, CI systems, a tolerance for legacy shell.",
                location="Remote",
                employment_type=EmploymentType.CONTRACT,
                salary_min=95000,
                salary_max=120000,
                created_at=utcnow() - timedelta(days=5),
            ),
            Job(
                employer_id=northwind.id,
                title="Front-end Engineer",
                description=(
                    "Build the operator console: dense tables, live status, keyboard "
                    "driven. Used eight hours a day by people who know it better than we do."
                ),
                requirements="TypeScript, React, an eye for interaction detail.",
                location="Brisbane, AU",
                employment_type=EmploymentType.FULL_TIME,
                salary_min=95000,
                salary_max=120000,
                created_at=utcnow() - timedelta(days=9),
            ),
            Job(
                employer_id=northwind.id,
                title="Data Analyst Internship",
                description=(
                    "A twelve-week placement working with our operations team on "
                    "carrier performance reporting."
                ),
                requirements="SQL, spreadsheets, curiosity. No prior industry experience needed.",
                location="Brisbane, AU",
                employment_type=EmploymentType.INTERNSHIP,
                salary_min=30000,
                salary_max=36000,
                status=JobStatus.CLOSED,
                created_at=utcnow() - timedelta(days=30),
            ),
        ]
        session.add_all(jobs)
        session.flush()

        session.add_all(
            [
                Application(
                    job_id=jobs[0].id,
                    job_seeker_id=ada.id,
                    status=ApplicationStatus.SHORTLISTED,
                    cover_letter=(
                        "The reconciliation work is the part of the posting that caught "
                        "my eye; I spent most of last year on something similar."
                    ),
                    created_at=utcnow() - timedelta(days=1),
                ),
                Application(
                    job_id=jobs[1].id,
                    job_seeker_id=ada.id,
                    status=ApplicationStatus.APPLIED,
                    cover_letter="Happy to scope the first month before committing to the rest.",
                ),
                Application(
                    job_id=jobs[2].id,
                    job_seeker_id=grace.id,
                    status=ApplicationStatus.REVIEWING,
                    cover_letter=(
                        "Dense operator tooling is my favourite kind of front-end work."
                    ),
                ),
            ]
        )

        session.add_all(
            [
                Document(
                    job_seeker_id=ada.id,
                    document_type=DocumentType.RESUME,
                    original_name="ada-mwangi-cv.pdf",
                    stored_name="documents/seed-ada-cv.pdf",
                    content_type="application/pdf",
                    size_bytes=184_320,
                    url="/uploads/documents/seed-ada-cv.pdf",
                    status=DocumentStatus.APPROVED,
                ),
                Document(
                    job_seeker_id=grace.id,
                    document_type=DocumentType.RESUME,
                    original_name="grace-otieno-cv.pdf",
                    stored_name="documents/seed-grace-cv.pdf",
                    content_type="application/pdf",
                    size_bytes=152_064,
                    url="/uploads/documents/seed-grace-cv.pdf",
                    status=DocumentStatus.PENDING,
                ),
                Document(
                    job_seeker_id=grace.id,
                    document_type=DocumentType.CERTIFICATE,
                    original_name="accessibility-certificate.pdf",
                    stored_name="documents/seed-grace-cert.pdf",
                    content_type="application/pdf",
                    size_bytes=98_304,
                    url="/uploads/documents/seed-grace-cert.pdf",
                    status=DocumentStatus.PENDING,
                ),
            ]
        )

        session.commit()

    print(
        "Seeded WorkWise.\n"
        f"  admin     admin@workwise.dev       / {ADMIN_PASSWORD}\n"
        f"  employer  hiring@northwind.dev     / {EMPLOYER_PASSWORD}  (verified)\n"
        f"  employer  talent@lumenlabs.dev     / {EMPLOYER_PASSWORD}  (unverified)\n"
        f"  seeker    ada@example.com          / {SEEKER_PASSWORD}\n"
        f"  seeker    grace@example.com        / {SEEKER_PASSWORD}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the WorkWise database")
    parser.add_argument(
        "--reset", action="store_true", help="drop all tables before seeding"
    )
    args = parser.parse_args()
    seed(reset=args.reset)
