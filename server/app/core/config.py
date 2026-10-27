"""Application configuration, loaded from the environment."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(SERVER_DIR / ".env", SERVER_DIR.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "WorkWise API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # Security -------------------------------------------------------------
    # Override in production. A stable value is required so that issued
    # tokens survive a server restart (the original app regenerated this on
    # every boot, which silently invalidated every session).
    SECRET_KEY: str = "dev-only-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database -------------------------------------------------------------
    DATABASE_URL: str = f"sqlite:///{SERVER_DIR / 'workwise.db'}"
    SQL_ECHO: bool = False

    # CORS -----------------------------------------------------------------
    # NoDecode stops pydantic-settings from trying to JSON-decode the raw
    # environment value, so the validator below can accept a plain
    # comma-separated list as well as a JSON array.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://localhost:3000",
    ]

    # Uploads --------------------------------------------------------------
    UPLOAD_DIR: Path = SERVER_DIR / "uploads"
    UPLOAD_URL_PATH: str = "/uploads"
    MAX_UPLOAD_MB: int = 10
    ALLOWED_IMAGE_TYPES: set[str] = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    ALLOWED_DOCUMENT_TYPES: set[str] = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "image/jpeg",
        "image/png",
    }

    # Seed accounts --------------------------------------------------------
    FIRST_ADMIN_EMAIL: str = "admin@workwise.dev"
    FIRST_ADMIN_PASSWORD: str = "admin1234"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept either `a,b,c` or `["a","b","c"]` for CORS_ORIGINS."""
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                import json

                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in text.split(",") if origin.strip()]
        return value

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
