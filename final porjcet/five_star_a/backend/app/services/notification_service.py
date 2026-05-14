from __future__ import annotations

from typing import Optional
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType


def create_notification(
    db: Session,
    *,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.system,
    related_task_id: Optional[UUID] = None,
    extra_data: Optional[dict] = None,
    commit: bool = True,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        related_task_id=related_task_id,
        extra_data=extra_data,
        is_read=False,
    )
    db.add(notification)

    if commit:
        db.commit()
        db.refresh(notification)

    return notification


def list_notifications(
    db: Session,
    user_id: UUID,
    *,
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Notification], int, int]:
    base_query = db.query(Notification).filter(Notification.user_id == user_id)
    query = base_query

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    total = query.count()
    unread_count = base_query.filter(Notification.is_read.is_(False)).count()
    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return notifications, total, unread_count


def list_notifications_since(
    db: Session,
    user_id: UUID,
    *,
    since: datetime,
    limit: int = 50,
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.created_at > since,
        )
        .order_by(Notification.created_at.asc())
        .limit(limit)
        .all()
    )


def mark_notification_read(db: Session, user_id: UUID, notification_id: UUID) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)

    return notification


def mark_all_notifications_read(db: Session, user_id: UUID) -> int:
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .all()
    )

    if not unread:
        return 0

    now = datetime.utcnow()
    for notification in unread:
        notification.is_read = True
        notification.read_at = now

    db.commit()
    return len(unread)


def unread_count(db: Session, user_id: UUID) -> int:
    return int(
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )
