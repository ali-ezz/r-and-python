"""Task attachments API."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services import attachment_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/tasks", tags=["task-attachments"])


class AttachmentResponse(BaseModel):
    id: str
    task_id: str
    file_url: str
    file_name: str
    file_type: str
    file_size: int
    uploaded_by: str
    created_at: str


@router.post("/{task_id}/attachments", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    task_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> AttachmentResponse:
    """Upload a file attachment for a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    attachment = await attachment_service.save_attachment(
        db, task_id, current_user.id, file
    )
    return AttachmentResponse(
        id=str(attachment.id),
        task_id=str(attachment.task_id),
        file_url=attachment.file_url,
        file_name=attachment.file_name,
        file_type=attachment.file_type,
        file_size=attachment.file_size,
        uploaded_by=str(attachment.uploaded_by),
        created_at=str(attachment.created_at),
    )


@router.get("/{task_id}/attachments", response_model=list[AttachmentResponse])
def list_attachments(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[AttachmentResponse]:
    """List all attachments for a task."""
    attachments = attachment_service.get_task_attachments(db, task_id)
    return [
        AttachmentResponse(
            id=str(a.id),
            task_id=str(a.task_id),
            file_url=a.file_url,
            file_name=a.file_name,
            file_type=a.file_type,
            file_size=a.file_size,
            uploaded_by=str(a.uploaded_by),
            created_at=str(a.created_at),
        )
        for a in attachments
    ]


@router.delete("/attachments/{attachment_id}", response_model=MessageResponse)
def delete_attachment(
    attachment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Delete an attachment."""
    attachment_service.delete_attachment(db, attachment_id, current_user.id)
    return MessageResponse(message="Attachment deleted successfully")
