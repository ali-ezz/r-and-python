from __future__ import annotations

from typing import Optional
import asyncio
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationBulkReadResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.services import notification_service
from app.utils.dependencies import get_current_active_user
from app.utils.security import decode_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_user_from_token(db: Session, token: str) -> Optional[User]:
    raw_token = token.strip()
    if raw_token.lower().startswith("bearer "):
        raw_token = raw_token.split(" ", 1)[1].strip()

    try:
        payload = decode_token(raw_token)
    except HTTPException:
        return None

    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        return None

    try:
        user_uuid = UUID(str(user_id))
    except ValueError:
        return None

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user or not user.is_active:
        return None

    return user


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> NotificationListResponse:
    notifications, total, unread = notification_service.list_notifications(
        db,
        current_user.id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(item) for item in notifications],
        total=total,
        unread=unread,
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> NotificationResponse:
    notification = notification_service.mark_notification_read(db, current_user.id, notification_id)
    return NotificationResponse.model_validate(notification)


@router.post("/read-all", response_model=NotificationBulkReadResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> NotificationBulkReadResponse:
    marked_read = notification_service.mark_all_notifications_read(db, current_user.id)
    return NotificationBulkReadResponse(marked_read=marked_read)


@router.websocket("/stream")
async def notifications_stream(websocket: WebSocket, token: str = Query(...)) -> None:
    db = SessionLocal()
    try:
        user = _get_user_from_token(db, token)
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await websocket.accept()
        last_seen = datetime.utcnow()

        while True:
            try:
                text = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                if text.strip().lower() == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                pass

            fresh = notification_service.list_notifications_since(
                db,
                user.id,
                since=last_seen,
                limit=50,
            )
            if fresh:
                for notification in fresh:
                    payload = NotificationResponse.model_validate(notification).model_dump(mode="json")
                    await websocket.send_json({"type": "notification", "data": payload})

                timestamps = [item.created_at for item in fresh if item.created_at is not None]
                if timestamps:
                    last_seen = max(timestamps)

            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        return
    finally:
        db.close()
