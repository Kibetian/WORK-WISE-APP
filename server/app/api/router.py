"""Aggregates every route module under a single API router."""

from fastapi import APIRouter

from app.api.routes import admin, applications, auth, employers, files, jobs, jobseekers

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(applications.router)
api_router.include_router(jobseekers.router)
api_router.include_router(employers.router)
api_router.include_router(files.router)
api_router.include_router(admin.router)
