"""WorkWise API application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.api.router import api_router
from app.core.config import settings
from app.db import init_db
from app.services.storage import ensure_upload_dir


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    ensure_upload_dir()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "Job board API. Job seekers build a profile, upload documents and apply; "
            "employers publish jobs and manage applicants; admins verify accounts."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_PREFIX)

    ensure_upload_dir()
    app.mount(
        settings.UPLOAD_URL_PATH,
        StaticFiles(directory=str(settings.UPLOAD_DIR)),
        name="uploads",
    )

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": settings.VERSION}

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        """Flatten FastAPI's validation errors into one readable message."""
        problems = []
        for error in exc.errors():
            location = ".".join(str(part) for part in error["loc"][1:]) or "body"
            problems.append(f"{location}: {error['msg']}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "; ".join(problems), "errors": problems},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_handler(_: Request, exc: IntegrityError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "That record conflicts with one that already exists"},
        )

    return app


app = create_app()
