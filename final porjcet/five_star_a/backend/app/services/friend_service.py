"""Friend connections service."""

from __future__ import annotations

from typing import Optional
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.integration import FriendConnection, FriendStatus
from app.models.user import User


def send_friend_request(
    db: Session,
    user_id: UUID,
    friend_email_or_username: str,
) -> FriendConnection:
    """Send a friend request to a user by email or username."""
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    friend = (
        db.query(User)
        .filter(
            or_(
                User.email == friend_email_or_username,
                User.username == friend_email_or_username,
            )
        )
        .first()
    )
    if not friend:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if friend.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add yourself")

    existing = (
        db.query(FriendConnection)
        .filter(
            or_(
                and_(FriendConnection.user_id == user_id, FriendConnection.friend_id == friend.id),
                and_(FriendConnection.user_id == friend.id, FriendConnection.friend_id == user_id),
            )
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Friend connection already exists")

    connection = FriendConnection(
        user_id=user_id,
        friend_id=friend.id,
        status=FriendStatus.pending,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


def get_pending_requests(
    db: Session,
    user_id: UUID,
) -> list[FriendConnection]:
    """Get all incoming friend requests for a user."""
    return (
        db.query(FriendConnection)
        .filter(
            FriendConnection.friend_id == user_id,
            FriendConnection.status == FriendStatus.pending,
        )
        .order_by(FriendConnection.requested_at.desc())
        .all()
    )


def get_friends_list(
    db: Session,
    user_id: UUID,
) -> list[FriendConnection]:
    """Get all accepted friend connections."""
    return (
        db.query(FriendConnection)
        .filter(
            FriendConnection.status == FriendStatus.accepted,
            or_(
                FriendConnection.user_id == user_id,
                FriendConnection.friend_id == user_id,
            ),
        )
        .all()
    )


def accept_friend_request(
    db: Session,
    user_id: UUID,
    connection_id: UUID,
) -> FriendConnection:
    """Accept a pending friend request."""
    connection = (
        db.query(FriendConnection)
        .filter(
            FriendConnection.id == connection_id,
            FriendConnection.friend_id == user_id,
            FriendConnection.status == FriendStatus.pending,
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending request not found")

    connection.status = FriendStatus.accepted
    connection.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(connection)
    return connection


def decline_friend_request(
    db: Session,
    user_id: UUID,
    connection_id: UUID,
) -> None:
    """Decline a pending friend request."""
    connection = (
        db.query(FriendConnection)
        .filter(
            FriendConnection.id == connection_id,
            FriendConnection.friend_id == user_id,
            FriendConnection.status == FriendStatus.pending,
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending request not found")

    db.delete(connection)
    db.commit()


def block_user(
    db: Session,
    user_id: UUID,
    connection_id: UUID,
) -> FriendConnection:
    """Block a friend connection."""
    connection = (
        db.query(FriendConnection)
        .filter(
            FriendConnection.id == connection_id,
            or_(
                FriendConnection.user_id == user_id,
                FriendConnection.friend_id == user_id,
            ),
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend connection not found")

    connection.status = FriendStatus.blocked
    db.commit()
    db.refresh(connection)
    return connection


def remove_friend(
    db: Session,
    user_id: UUID,
    connection_id: UUID,
) -> None:
    """Remove a friend connection entirely."""
    connection = (
        db.query(FriendConnection)
        .filter(
            FriendConnection.id == connection_id,
            or_(
                FriendConnection.user_id == user_id,
                FriendConnection.friend_id == user_id,
            ),
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend connection not found")

    db.delete(connection)
    db.commit()


def get_friend_count(
    db: Session,
    user_id: UUID,
) -> int:
    """Get the number of accepted friends for a user."""
    return (
        db.query(FriendConnection)
        .filter(
            or_(
                and_(FriendConnection.user_id == user_id, FriendConnection.status == FriendStatus.accepted),
                and_(FriendConnection.friend_id == user_id, FriendConnection.status == FriendStatus.accepted),
            )
        )
        .count()
    )
