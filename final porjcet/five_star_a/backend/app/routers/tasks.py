from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.task import (
    TaskCreate,
    TaskFilterRequest,
    TaskListResponse,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services import task_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/tasks", tags=["tasks"])


class AssignTaskRequest(BaseModel):
    user_id: Optional[UUID] = None


class VoiceTaskRequest(BaseModel):
    project_id: UUID
    text: str


class EmailTaskRequest(BaseModel):
    project_id: UUID
    subject: str
    body: Optional[str] = None


class RecurrenceRunResponse(BaseModel):
    generated: list[TaskResponse]
    count: int


def _role_value(user: User) -> str:
    """Extract role as a plain string from the user object."""
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _require_not_employee(user: User, action: str = "perform this action"):
    if _role_value(user) == "employee":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Employees cannot {action}")


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[UUID] = None,
    project_id: Optional[UUID] = None,
    due_date: Optional[str] = Query(None, description="Filter by due date (YYYY-MM-DD)"),
    q: Optional[str] = Query(None, description="Search in title/description"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskListResponse:
    filters = TaskFilterRequest(
        status=status, priority=priority, assigned_to=assigned_to,
        project_id=project_id, skip=skip, limit=limit,
    )
    tasks, total = task_service.list_tasks(db, filters, current_user, search=q, due_date=due_date)
    return TaskListResponse(tasks=[TaskResponse.model_validate(task) for task in tasks], total=total)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    _require_not_employee(current_user, "create tasks")
    task = task_service.create_task(db, current_user.id, payload)
    return TaskResponse.model_validate(task)


@router.post("/voice", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task_from_voice(
    payload: VoiceTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    _require_not_employee(current_user, "create tasks")
    task = task_service.create_task_from_text(db, current_user.id, payload.project_id, payload.text)
    return TaskResponse.model_validate(task)


@router.post("/email", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task_from_email(
    payload: EmailTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    _require_not_employee(current_user, "create tasks")
    from app.services import email_service
    parsed = email_service.parse_email_to_task(payload.subject, payload.body)
    task = task_service.create_task(
        db, current_user.id,
        TaskCreate(title=parsed["title"], description=parsed["description"],
                   priority=parsed["priority"], project_id=payload.project_id),
    )
    return TaskResponse.model_validate(task)


@router.post("/recurrence/run", response_model=RecurrenceRunResponse)
def run_recurrence(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RecurrenceRunResponse:
    _require_not_employee(current_user, "run recurrence")
    generated = task_service.run_recurrence_generation(db, current_user.id, limit=limit)
    items = [TaskResponse.model_validate(task) for task in generated]
    return RecurrenceRunResponse(generated=items, count=len(items))


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    updated = task_service.update_task(db, task, payload, actor_id=current_user.id, actor=current_user)
    return TaskResponse.model_validate(updated)


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    role = _role_value(current_user)
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete tasks")
    task_service.delete_task(db, task)
    return MessageResponse(message="Task deleted successfully")


@router.patch("/{task_id}/status", response_model=TaskResponse)
def patch_task_status(
    task_id: UUID,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    updated, _generated = task_service.update_task_status(db, task, payload.status, actor_id=current_user.id)
    return TaskResponse.model_validate(updated)


@router.post("/{task_id}/reopen", response_model=TaskResponse)
def reopen_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    reopened = task_service.reopen_task(db, task)
    return TaskResponse.model_validate(reopened)


@router.post("/{task_id}/assign", response_model=TaskResponse)
def assign_task(
    task_id: UUID,
    payload: AssignTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    role = _role_value(current_user)
    if task.created_by != current_user.id and role not in ("admin", "project_manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins or managers can assign tasks")
    task = task_service.assign_task(db, task, payload.user_id)
    return TaskResponse.model_validate(task)


@router.post("/{task_id}/recurrence/next", response_model=TaskResponse)
def generate_next_recurrence(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TaskResponse:
    task = task_service.get_task(db, task_id)
    if not task_service.user_can_access_task(db, current_user, task):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.created_by != current_user.id and _role_value(current_user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    next_task = task_service.generate_next_recurring_task(db, task)
    return TaskResponse.model_validate(next_task)
