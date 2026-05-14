from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.team_chat import TeamChatMessage
from app.schemas.team_chat import TeamChatMessageCreate


def list_messages(
	db: Session,
	*,
	workspace_id: UUID,
	skip: int = 0,
	limit: int = 50,
) -> tuple[list[TeamChatMessage], int]:
	query = db.query(TeamChatMessage).filter(TeamChatMessage.workspace_id == workspace_id)
	total = query.with_entities(func.count(TeamChatMessage.id)).scalar() or 0
	messages = (
		query.order_by(TeamChatMessage.created_at.asc())
		.offset(skip)
		.limit(limit)
		.all()
	)
	return messages, total


def create_message(
    db: Session,
    user_id: UUID,
	workspace_id: UUID,
    payload: TeamChatMessageCreate,
) -> TeamChatMessage:
    message = TeamChatMessage(user_id=user_id, workspace_id=workspace_id, content=payload.content.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def update_message(
    db: Session,
    current_user,
    message_id: UUID,
    payload: TeamChatMessageCreate,
) -> TeamChatMessage:
    message = (
        db.query(TeamChatMessage)
        .filter(TeamChatMessage.id == message_id)
        .first()
    )
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    # Allow message owner, admin, or project manager to edit
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if message.user_id != current_user.id and user_role not in ['admin', 'project_manager']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's message")
    message.content = payload.content.strip()
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def delete_message(db: Session, current_user, message_id: UUID) -> bool:
    message = (
        db.query(TeamChatMessage)
        .filter(TeamChatMessage.id == message_id)
        .first()
    )
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    # Allow message owner, admin, or project manager to delete
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if message.user_id != current_user.id and user_role not in ['admin', 'project_manager']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's message")
    db.delete(message)
    db.commit()
    return True
