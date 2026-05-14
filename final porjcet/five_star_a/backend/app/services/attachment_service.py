"""Task attachments service with file upload handling."""

from __future__ import annotations

from typing import Optional
import os
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.task import TaskAttachment

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "attachments"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "text/plain", "text/csv", "text/markdown",
    "application/json",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def ensure_upload_dir() -> Path:
    """Ensure the upload directory exists."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


async def save_attachment(
    db: Session,
    task_id: UUID,
    user_id: UUID,
    file: UploadFile,
) -> TaskAttachment:
    """Save an uploaded file and create an attachment record."""
    ensure_upload_dir()

    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' is not allowed",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 50 MB limit",
        )

    safe_filename = file.filename or "unnamed"
    file_ext = safe_filename.rsplit(".", 1)[-1] if "." in safe_filename else "bin"
    unique_name = f"{uuid.uuid4().hex}.{file_ext}"
    file_path = UPLOAD_DIR / unique_name

    with open(file_path, "wb") as f:
        f.write(content)

    attachment = TaskAttachment(
        task_id=task_id,
        file_url=f"/uploads/attachments/{unique_name}",
        file_name=file.filename or "unnamed",
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        uploaded_by=user_id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def get_attachment(
    db: Session,
    attachment_id: UUID,
) -> TaskAttachment:
    """Get an attachment by ID."""
    attachment = db.query(TaskAttachment).filter(TaskAttachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return attachment


def get_task_attachments(
    db: Session,
    task_id: UUID,
) -> list[TaskAttachment]:
    """Get all attachments for a task."""
    return (
        db.query(TaskAttachment)
        .filter(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.created_at.desc())
        .all()
    )


def delete_attachment(
    db: Session,
    attachment_id: UUID,
    user_id: UUID,
) -> None:
    """Delete an attachment (uploader only or admin)."""
    attachment = (
        db.query(TaskAttachment)
        .filter(TaskAttachment.id == attachment_id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    if attachment.uploaded_by != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only uploader can delete attachment")

    file_path = UPLOAD_DIR / attachment.file_url.split("/")[-1]
    if file_path.exists():
        file_path.unlink()

    db.delete(attachment)
    db.commit()
