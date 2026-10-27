"""Local file storage.

Uploads are written to ``settings.UPLOAD_DIR`` and served back by the API as
static files, so the application runs with no third-party account. The original
project hardcoded live Cloudinary credentials in source; nothing here needs an
external service.
"""

from __future__ import annotations

import re
import secrets
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
_CHUNK = 1024 * 1024


@dataclass(frozen=True)
class StoredFile:
    stored_name: str
    original_name: str
    content_type: str
    size_bytes: int
    url: str
    path: Path


def _sanitize(name: str) -> str:
    cleaned = _SAFE_NAME.sub("_", Path(name or "file").name).strip("._-")
    return cleaned[:120] or "file"


def ensure_upload_dir() -> Path:
    directory = Path(settings.UPLOAD_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save_upload(
    upload: UploadFile,
    *,
    subdir: str,
    allowed_types: set[str],
) -> StoredFile:
    if not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No file was provided"
        )

    content_type = (upload.content_type or "application/octet-stream").split(";")[0].strip()
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Allowed: "
            + ", ".join(sorted(allowed_types)),
        )

    target_dir = ensure_upload_dir() / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    original_name = _sanitize(upload.filename)
    suffix = Path(original_name).suffix
    stored_name = f"{secrets.token_hex(16)}{suffix}"
    destination = target_dir / stored_name

    size = 0
    upload.file.seek(0)
    try:
        with destination.open("wb") as handle:
            while chunk := upload.file.read(_CHUNK):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    handle.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {settings.MAX_UPLOAD_MB}MB limit",
                    )
                handle.write(chunk)
    except HTTPException:
        raise
    except OSError as exc:  # pragma: no cover - filesystem failure
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not store the file: {exc}",
        ) from exc
    finally:
        upload.file.close()

    if size == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty"
        )

    return StoredFile(
        stored_name=f"{subdir}/{stored_name}",
        original_name=upload.filename,
        content_type=content_type,
        size_bytes=size,
        url=f"{settings.UPLOAD_URL_PATH}/{subdir}/{stored_name}",
        path=destination,
    )


def delete_stored_file(stored_name: str) -> None:
    """Remove a previously stored file, ignoring anything outside UPLOAD_DIR."""
    root = Path(settings.UPLOAD_DIR).resolve()
    try:
        candidate = (root / stored_name).resolve()
        candidate.relative_to(root)
    except (ValueError, OSError):
        return
    candidate.unlink(missing_ok=True)
