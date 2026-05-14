"""Friends API - social connections."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services import friend_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/friends", tags=["friends"])


class FriendRequestPayload(BaseModel):
    """Payload to send a friend request."""
    email_or_username: str = Field(min_length=1, max_length=255)


class FriendResponse(BaseModel):
    id: str
    friend_id: str
    friend_username: str
    friend_email: str
    friend_full_name: Optional[str]
    status: str
    requested_at: str
    accepted_at: Optional[str]


def _build_friend_response(connection, db: Session) -> FriendResponse:
    """Build a friend response object."""
    friend_user = db.query(User).filter(User.id == connection.friend_id).first()
    if not friend_user:
        friend_user = db.query(User).filter(User.id == connection.user_id).first()

    if not friend_user:
        # Both users deleted - return fallback
        return FriendResponse(
            id=str(connection.id),
            friend_id=str(connection.friend_id),
            friend_username="Unknown User",
            friend_email="",
            friend_full_name=None,
            status=connection.status.value if hasattr(connection.status, "value") else str(connection.status),
            requested_at=str(connection.requested_at),
            accepted_at=str(connection.accepted_at) if connection.accepted_at else None,
        )

    return FriendResponse(
        id=str(connection.id),
        friend_id=str(connection.friend_id),
        friend_username=friend_user.username,
        friend_email=friend_user.email,
        friend_full_name=friend_user.full_name,
        status=connection.status.value if hasattr(connection.status, "value") else str(connection.status),
        requested_at=str(connection.requested_at),
        accepted_at=str(connection.accepted_at) if connection.accepted_at else None,
    )


@router.post("/request", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_request(
    payload: FriendRequestPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Send a friend request."""
    friend_service.send_friend_request(
        db, current_user.id, payload.email_or_username
    )
    return MessageResponse(message="Friend request sent")


@router.get("/pending", response_model=list[FriendResponse])
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[FriendResponse]:
    """Get incoming friend requests."""
    requests = friend_service.get_pending_requests(db, current_user.id)
    return [_build_friend_response(r, db) for r in requests]


@router.get("", response_model=list[FriendResponse])
def get_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[FriendResponse]:
    """Get friends list."""
    friends = friend_service.get_friends_list(db, current_user.id)
    return [_build_friend_response(f, db) for f in friends]


@router.post("/{connection_id}/accept", response_model=MessageResponse)
def accept_request(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Accept a friend request."""
    friend_service.accept_friend_request(db, current_user.id, connection_id)
    return MessageResponse(message="Friend request accepted")


@router.post("/{connection_id}/decline", response_model=MessageResponse)
def decline_request(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Decline a friend request."""
    friend_service.decline_friend_request(db, current_user.id, connection_id)
    return MessageResponse(message="Friend request declined")


@router.post("/{connection_id}/block", response_model=MessageResponse)
def block_friend(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Block a user."""
    friend_service.block_user(db, current_user.id, connection_id)
    return MessageResponse(message="User blocked")


@router.delete("/{connection_id}", response_model=MessageResponse)
def remove_friend(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Remove a friend connection."""
    friend_service.remove_friend(db, current_user.id, connection_id)
    return MessageResponse(message="Friend removed")


@router.get("/count", response_model=dict)
def friend_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get friend count."""
    count = friend_service.get_friend_count(db, current_user.id)
    return {"count": count}
