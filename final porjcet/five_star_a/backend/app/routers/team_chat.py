from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.team_chat import TeamChatMessageCreate, TeamChatMessageListResponse, TeamChatMessageResponse
from app.services import team_chat_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/chat", tags=["team-chat"])


@router.get("", response_model=TeamChatMessageListResponse)
def list_messages(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TeamChatMessageListResponse:
    messages, total = team_chat_service.list_messages(
        db, workspace_id=current_user.workspace_id, skip=skip, limit=limit
    )
    items = []
    for msg in messages:
        items.append(TeamChatMessageResponse(
            id=msg.id,
            user_id=msg.user_id,
            username=msg.user.username,
            full_name=msg.user.full_name,
            avatar_url=msg.user.avatar_url,
            content=msg.content,
            created_at=msg.created_at,
        ))
    return TeamChatMessageListResponse(messages=items, total=total)


@router.post("", response_model=TeamChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: TeamChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TeamChatMessageResponse:
    msg = team_chat_service.create_message(db, current_user.id, current_user.workspace_id, payload)
    return TeamChatMessageResponse(
        id=msg.id,
        user_id=msg.user_id,
        username=msg.user.username,
        full_name=msg.user.full_name,
        avatar_url=msg.user.avatar_url,
        content=msg.content,
        created_at=msg.created_at,
    )


@router.patch("/{message_id}", response_model=TeamChatMessageResponse)
def update_message(
    message_id: UUID,
    payload: TeamChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TeamChatMessageResponse:
    msg = team_chat_service.update_message(db, current_user, message_id, payload)
    return TeamChatMessageResponse(
        id=msg.id,
        user_id=msg.user_id,
        username=msg.user.username,
        full_name=msg.user.full_name,
        avatar_url=msg.user.avatar_url,
        content=msg.content,
        created_at=msg.created_at,
    )


@router.delete("/{message_id}", response_model=MessageResponse)
def delete_message(
    message_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    team_chat_service.delete_message(db, current_user, message_id)
    return MessageResponse(message="Message deleted")
