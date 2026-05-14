from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, conint, constr


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskRecurrenceRule(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TaskBase(BaseModel):
    title: constr(min_length=1, max_length=500)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    difficulty: conint(ge=1, le=10) = 1
    urgency: conint(ge=1, le=10) = 1
    importance: conint(ge=1, le=10) = 1


class TaskCreate(TaskBase):
    project_id: UUID
    assigned_to: Optional[UUID] = None
    due_date: Optional[datetime] = None
    location: Optional[str] = None
    recurrence_rule: Optional[TaskRecurrenceRule] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    project_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    due_date: Optional[datetime] = None
    difficulty: Optional[conint(ge=1, le=10)] = None
    urgency: Optional[conint(ge=1, le=10)] = None
    importance: Optional[conint(ge=1, le=10)] = None
    location: Optional[str] = None
    recurrence_rule: Optional[TaskRecurrenceRule] = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    difficulty: int
    urgency: int
    importance: int
    project_id: UUID
    assigned_to: Optional[UUID] = None
    created_by: UUID
    location: Optional[str] = None
    recurrence_rule: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int


class TaskFilterRequest(BaseModel):
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to: Optional[UUID] = None
    project_id: Optional[UUID] = None
    skip: int = 0
    limit: int = 50
