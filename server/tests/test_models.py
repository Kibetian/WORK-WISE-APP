"""The ORM mapping itself.

These are canaries. A broken relationship annotation makes every database-
touching endpoint return 500, and the traceback it produces is long enough to
bury the one line that matters, so it is worth failing here first with a short
message.
"""

import pytest
from sqlalchemy.orm import class_mapper, configure_mappers
from sqlmodel import SQLModel

from app import models


def test_every_mapper_configures() -> None:
    """Resolves all relationship targets. Fails if any annotation is unusable.

    `models.py` must not use `from __future__ import annotations`: under PEP
    563 the annotations become strings, SQLModel passes text it cannot reduce
    to a class name straight to SQLAlchemy, and this call raises
    "failed to locate a name".
    """
    configure_mappers()


@pytest.mark.parametrize(
    ("model", "relationship_name", "target"),
    [
        (models.User, "job_seeker", models.JobSeekerProfile),
        (models.User, "employer", models.EmployerProfile),
        (models.JobSeekerProfile, "user", models.User),
        (models.JobSeekerProfile, "applications", models.Application),
        (models.JobSeekerProfile, "documents", models.Document),
        (models.EmployerProfile, "user", models.User),
        (models.EmployerProfile, "jobs", models.Job),
        (models.Job, "employer", models.EmployerProfile),
        (models.Job, "applications", models.Application),
        (models.Application, "job", models.Job),
        (models.Application, "job_seeker", models.JobSeekerProfile),
        (models.Document, "job_seeker", models.JobSeekerProfile),
    ],
)
def test_relationship_points_at_the_right_model(
    model: type, relationship_name: str, target: type
) -> None:
    relationship = class_mapper(model).relationships[relationship_name]
    assert relationship.mapper.class_ is target


def test_models_module_avoids_postponed_annotations() -> None:
    from pathlib import Path

    source = Path(models.__file__).read_text(encoding="utf-8")
    assert "from __future__ import annotations" not in source, (
        "PEP 563 breaks SQLModel relationship resolution in this module; "
        "see the comment at the top of models.py"
    )


def test_expected_tables_exist() -> None:
    assert set(SQLModel.metadata.tables) == {
        "users",
        "job_seeker_profiles",
        "employer_profiles",
        "jobs",
        "applications",
        "documents",
    }


def test_application_has_a_unique_constraint_per_job_and_seeker() -> None:
    """One application per person per job, enforced by the database."""
    constraints = {
        tuple(sorted(column.name for column in constraint.columns))
        for constraint in models.Application.__table__.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }
    assert ("job_id", "job_seeker_id") in constraints
