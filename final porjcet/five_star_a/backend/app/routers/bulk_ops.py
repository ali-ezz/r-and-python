"""Bulk operations for tasks."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.task import Task, TaskPriority as TaskPriorityModel, TaskStatus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.task import TaskPriority, TaskResponse, TaskStatus as TaskStatusSchema
from app.services import task_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/tasks", tags=["task-bulk"])


def _role_value(user: User) -> str:
	return user.role.value if hasattr(user.role, "value") else str(user.role)


def _require_not_employee(user: User) -> None:
	if _role_value(user) == "employee":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees cannot use bulk task operations")


class BulkCreateItem(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    project_id: UUID
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[str] = None


class BulkStatusUpdate(BaseModel):
    task_ids: list[UUID]
    status: TaskStatus


class BulkPriorityUpdate(BaseModel):
    task_ids: list[UUID]
    priority: TaskPriority


class BulkDeleteRequest(BaseModel):
    task_ids: list[UUID]


class BulkResponse(BaseModel):
    success_count: int
    failed_count: int
    results: list[dict]
    errors: list[str]


@router.post("/bulk/create", response_model=BulkResponse, status_code=status.HTTP_201_CREATED)
def bulk_create_tasks(
    payload: list[BulkCreateItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BulkResponse:
    """Create multiple tasks at once."""
    _require_not_employee(current_user)
    results = []
    errors = []

    for item in payload:
        try:
            project = db.query(Project).filter(Project.id == item.project_id).first()
            if not project or project.workspace_id != current_user.workspace_id:
                errors.append(f"Invalid project for '{item.title}'")
                continue
            task = Task(
                title=item.title,
                description=item.description,
                project_id=item.project_id,
                priority=TaskPriorityModel(item.priority.value),
                created_by=current_user.id,
                status=TaskStatus.todo,
            )
            db.add(task)
            db.flush()
            results.append({"title": item.title, "id": str(task.id)})
        except Exception as e:
            errors.append(f"Failed to create '{item.title}': {str(e)}")

    db.commit()
    task_service.invalidate_task_cache()
    # IDs are already set after flush, no need to refresh

    return BulkResponse(
        success_count=len(results),
        failed_count=len(errors),
        results=results,
        errors=errors,
    )


@router.patch("/bulk/status", response_model=BulkResponse)
def bulk_update_status(
    payload: BulkStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BulkResponse:
    """Update status for multiple tasks."""
    _require_not_employee(current_user)
    project_ids_q = db.query(Project.id).filter(Project.workspace_id == current_user.workspace_id)
    role = _role_value(current_user)
    query = db.query(Task).filter(Task.id.in_(payload.task_ids), Task.project_id.in_(project_ids_q))
    if role not in ("admin", "project_manager"):
        query = query.filter(Task.created_by == current_user.id)

    tasks = query.all()
    target_status = TaskStatusSchema(payload.status.value)
    errors = []
    updated_ids = []
    updated = 0

    for task in tasks:
        try:
            current_status = TaskStatusSchema(task.status.value if hasattr(task.status, "value") else str(task.status))
            task_service.validate_status_transition(current_status, target_status)
            task.status = TaskStatus(target_status.value)
            task.completed_at = datetime.utcnow() if target_status == TaskStatusSchema.DONE else None
            updated_ids.append(str(task.id))
            updated += 1
        except HTTPException as exc:
            errors.append(f"{task.id}: {exc.detail}")

    db.commit()
    if updated:
        task_service.invalidate_task_cache()
    return BulkResponse(
        success_count=updated,
        failed_count=len(payload.task_ids) - updated,
        results=[{"task_id": task_id, "status": payload.status.value} for task_id in updated_ids],
        errors=errors,
    )


@router.patch("/bulk/priority", response_model=BulkResponse)
def bulk_update_priority(
    payload: BulkPriorityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BulkResponse:
    """Update priority for multiple tasks."""
    _require_not_employee(current_user)
    project_ids_q = db.query(Project.id).filter(Project.workspace_id == current_user.workspace_id)
    updated = (
        db.query(Task)
        .filter(
            Task.id.in_(payload.task_ids),
            Task.project_id.in_(project_ids_q),
            Task.created_by == current_user.id,
        )
        .update({"priority": payload.priority.value}, synchronize_session="fetch")
    )
    db.commit()
    if updated:
        task_service.invalidate_task_cache()
    return BulkResponse(
        success_count=updated,
        failed_count=len(payload.task_ids) - updated,
        results=[{"task_id": str(tid), "priority": payload.priority.value} for tid in payload.task_ids[:updated]],
        errors=[],
    )


@router.delete("/bulk/delete", response_model=BulkResponse)
def bulk_delete_tasks(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BulkResponse:
    """Delete multiple tasks."""
    _require_not_employee(current_user)
    project_ids_q = db.query(Project.id).filter(Project.workspace_id == current_user.workspace_id)
    deleted = (
        db.query(Task)
        .filter(
            Task.id.in_(payload.task_ids),
            Task.project_id.in_(project_ids_q),
            Task.created_by == current_user.id,
        )
        .delete(synchronize_session="fetch")
    )
    db.commit()
    if deleted:
        task_service.invalidate_task_cache()
    return BulkResponse(
        success_count=deleted,
        failed_count=len(payload.task_ids) - deleted,
        results=[{"task_id": str(tid)} for tid in payload.task_ids[:deleted]],
        errors=[],
    )
