"""Task comments service."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task import TaskComment


def create_comment(
    db: Session,
    task_id: UUID,
    user_id: UUID,
    content: str,
) -> TaskComment:
    """Create a new comment on a task."""
    if not content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment content cannot be empty")

    comment = TaskComment(
        task_id=task_id,
        user_id=user_id,
        content=content.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_task_comments(
    db: Session,
    task_id: UUID,
) -> list[TaskComment]:
    """Get all comments for a task."""
    return (
        db.query(TaskComment)
        .filter(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
        .all()
    )


def update_comment(
    db: Session,
    comment_id: UUID,
    user_id: UUID,
    content: str,
) -> TaskComment:
    """Update a comment (owner only)."""
    comment = (
        db.query(TaskComment)
        .filter(TaskComment.id == comment_id, TaskComment.user_id == user_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found or unauthorized")

    stripped = content.strip()
    if not stripped:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment content cannot be empty")

    comment.content = stripped
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(
    db: Session,
    comment_id: UUID,
    user_id: UUID,
) -> None:
    """Delete a comment (owner only)."""
    comment = (
        db.query(TaskComment)
        .filter(TaskComment.id == comment_id, TaskComment.user_id == user_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found or unauthorized")

    db.delete(comment)
    db.commit()
