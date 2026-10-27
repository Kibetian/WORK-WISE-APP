"""Settings parsing.

CORS_ORIGINS is the one that bites: pydantic-settings JSON-decodes complex
types from the environment before validators run, so without NoDecode the
documented `CORS_ORIGINS=a,b` form raises at import and the API never starts.
"""

import pytest

from app.core.config import Settings


def settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_defaults_are_usable() -> None:
    config = settings()
    assert "http://localhost:5173" in config.CORS_ORIGINS
    assert config.max_upload_bytes == config.MAX_UPLOAD_MB * 1024 * 1024
    # HS256 wants at least 32 bytes of key material.
    assert len(config.SECRET_KEY.encode()) >= 32


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://a.test", ["https://a.test"]),
        ("https://a.test,https://b.test", ["https://a.test", "https://b.test"]),
        (" https://a.test , https://b.test ", ["https://a.test", "https://b.test"]),
        ('["https://a.test","https://b.test"]', ["https://a.test", "https://b.test"]),
        ("", []),
    ],
)
def test_cors_origins_accepts_both_forms(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: list[str]
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert settings().CORS_ORIGINS == expected


def test_environment_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "a-different-secret-entirely")
    monkeypatch.setenv("MAX_UPLOAD_MB", "25")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@db:5432/workwise")

    config = settings()
    assert config.SECRET_KEY == "a-different-secret-entirely"
    assert config.MAX_UPLOAD_MB == 25
    assert config.max_upload_bytes == 25 * 1024 * 1024
    assert config.DATABASE_URL.startswith("postgresql+psycopg://")
