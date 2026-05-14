from __future__ import annotations

from typing import Optional
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationTypeValue(str, Enum):
    SYSTEM = "system"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    RECURRING_GENERATED = "recurring_generated"


class NotificationResponse(BaseModel):
    id: UUID
    title: str
    message: str
    notification_type: NotificationTypeValue
    related_task_id: Optional[UUID] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    extra_data: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread: int


class NotificationBulkReadResponse(BaseModel):
    marked_read: int
