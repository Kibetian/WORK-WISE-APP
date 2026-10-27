"""Uploads: profile images, company logos and job seeker documents."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.deps import (
    CurrentEmployerProfile,
    CurrentJobSeekerProfile,
    SessionDep,
)
from app.models import Document, DocumentType, utcnow
from app.schemas import DocumentRead, Message, UploadRead
from app.services.storage import delete_stored_file, save_upload

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/profile-image", response_model=UploadRead)
def upload_profile_image(
    session: SessionDep,
    profile: CurrentJobSeekerProfile,
    file: Annotated[UploadFile, File(description="JPEG, PNG, WebP or GIF")],
) -> UploadRead:
    stored = save_upload(file, subdir="avatars", allowed_types=settings.ALLOWED_IMAGE_TYPES)
    profile.profile_image_url = stored.url
    profile.updated_at = utcnow()
    session.add(profile)
    session.commit()
    return UploadRead(url=stored.url, message="Profile image updated")


@router.post("/company-logo", response_model=UploadRead)
def upload_company_logo(
    session: SessionDep,
    employer: CurrentEmployerProfile,
    file: Annotated[UploadFile, File(description="JPEG, PNG, WebP or GIF")],
) -> UploadRead:
    stored = save_upload(file, subdir="logos", allowed_types=settings.ALLOWED_IMAGE_TYPES)
    employer.logo_url = stored.url
    employer.updated_at = utcnow()
    session.add(employer)
    session.commit()
    return UploadRead(url=stored.url, message="Company logo updated")


@router.post("/documents", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    session: SessionDep,
    profile: CurrentJobSeekerProfile,
    file: Annotated[UploadFile, File(description="PDF, Word, plain text or an image")],
    document_type: Annotated[DocumentType, Form()] = DocumentType.RESUME,
) -> DocumentRead:
    stored = save_upload(
        file, subdir="documents", allowed_types=settings.ALLOWED_DOCUMENT_TYPES
    )
    document = Document(
        job_seeker_id=profile.id,
        document_type=document_type,
        original_name=stored.original_name,
        stored_name=stored.stored_name,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
        url=stored.url,
    )
    session.add(document)
    session.commit()
    session.refresh(document)
    return DocumentRead.model_validate(document)


@router.delete("/documents/{document_id}", response_model=Message)
def delete_document(
    document_id: int,
    session: SessionDep,
    profile: CurrentJobSeekerProfile,
) -> Message:
    document = session.get(Document, document_id)
    if document is None or document.job_seeker_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    delete_stored_file(document.stored_name)
    session.delete(document)
    session.commit()
    return Message(message="Document deleted")
