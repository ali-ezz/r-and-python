"""Task comments API."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services import comment_service, task_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/tasks", tags=["task-comments"])


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class CommentResponse(BaseModel):
    id: str
    task_id: str
    user_id: str
    username: str
    avatar_url: Optional[str]
    content: str
    created_at: str
    updated_at: Optional[str]


@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> CommentResponse:
    """Add a comment to a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    comment = comment_service.create_comment(
        db, task_id, current_user.id, payload.content
    )
    return CommentResponse(
        id=str(comment.id),
        task_id=str(comment.task_id),
        user_id=str(comment.user_id),
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        content=comment.content,
        created_at=str(comment.created_at),
        updated_at=str(comment.updated_at) if comment.updated_at else None,
    )


@router.get("/{task_id}/comments", response_model=list[CommentResponse])
def list_comments(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[CommentResponse]:
    """Get all comments for a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    comments = comment_service.get_task_comments(db, task_id)
    result = []
    for comment in comments:
        user = db.query(User).filter(User.id == comment.user_id).first()
        result.append(CommentResponse(
            id=str(comment.id),
            task_id=str(comment.task_id),
            user_id=str(comment.user_id),
            username=user.username if user else "unknown",
            avatar_url=user.avatar_url if user else None,
            content=comment.content,
            created_at=str(comment.created_at),
            updated_at=str(comment.updated_at) if comment.updated_at else None,
        ))
    return result


@router.put("/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> CommentResponse:
    """Update a comment."""
    from app.models.task import TaskComment

    existing = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    task = db.query(Task).filter(Task.id == existing.task_id).first()
    if not task or not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    comment = comment_service.update_comment(db, comment_id, current_user.id, payload.content)
    return CommentResponse(
        id=str(comment.id),
        task_id=str(comment.task_id),
        user_id=str(comment.user_id),
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        content=comment.content,
        created_at=str(comment.created_at),
        updated_at=str(comment.updated_at) if comment.updated_at else None,
    )


@router.delete("/comments/{comment_id}", response_model=MessageResponse)
def delete_comment(
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Delete a comment."""
    from app.models.task import TaskComment

    existing = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    task = db.query(Task).filter(Task.id == existing.task_id).first()
    if not task or not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    comment_service.delete_comment(db, comment_id, current_user.id)
    return MessageResponse(message="Comment deleted successfully")
