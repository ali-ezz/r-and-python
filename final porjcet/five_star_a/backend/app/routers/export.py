"""Data export API - export tasks and analytics as JSON or CSV."""

from __future__ import annotations

from typing import Optional
import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.integration import UserAnalytics
from app.models.task import Task
from app.models.user import User
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/export", tags=["export"])


class TaskExportItem(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    project_id: str
    due_date: Optional[str]
    created_at: str
    completed_at: Optional[str]
    location: Optional[str]
    recurrence_rule: Optional[str]


class TasksExportResponse(BaseModel):
    exported_at: str
    user: str
    task_count: int
    tasks: list[TaskExportItem]


class AnalyticsExportItem(BaseModel):
    date: str
    tasks_created: int
    tasks_completed: int
    tasks_overdue: int
    pomodoro_sessions: int
    active_minutes: int
    productivity_score: float


class AnalyticsExportResponse(BaseModel):
    exported_at: str
    user: str
    period_days: int
    data: list[AnalyticsExportItem]


def _task_status(t) -> str:
    return t.status.value if hasattr(t.status, "value") else str(t.status)


def _task_priority(t) -> str:
    return t.priority.value if hasattr(t.priority, "value") else str(t.priority)


@router.get("/tasks/json", response_model=TasksExportResponse)
async def export_tasks_json(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TasksExportResponse:
    """Export tasks as JSON."""
    query = db.query(Task).filter(
        or_(Task.created_by == current_user.id, Task.assigned_to == current_user.id)
    )
    if status_filter:
        query = query.filter(Task.status == status_filter)

    tasks = query.order_by(Task.created_at.desc()).all()
    task_items = [
        TaskExportItem(
            id=str(t.id),
            title=t.title,
            description=t.description,
            status=_task_status(t),
            priority=_task_priority(t),
            project_id=str(t.project_id),
            due_date=str(t.due_date) if t.due_date else None,
            created_at=str(t.created_at),
            completed_at=str(t.completed_at) if t.completed_at else None,
            location=t.location,
            recurrence_rule=t.recurrence_rule,
        )
        for t in tasks
    ]
    return TasksExportResponse(
        exported_at=date.today().isoformat(),
        user=current_user.username,
        task_count=len(task_items),
        tasks=task_items,
    )


@router.get("/tasks/csv")
async def export_tasks_csv(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StreamingResponse:
    """Export tasks as CSV."""
    query = db.query(Task).filter(
        or_(Task.created_by == current_user.id, Task.assigned_to == current_user.id)
    )
    if status_filter:
        query = query.filter(Task.status == status_filter)

    tasks = query.order_by(Task.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Title", "Description", "Status", "Priority",
        "Project ID", "Due Date", "Created At", "Completed At", "Location"
    ])
    for t in tasks:
        writer.writerow([
            str(t.id),
            t.title,
            t.description or "",
            _task_status(t),
            _task_priority(t),
            str(t.project_id),
            str(t.due_date) if t.due_date else "",
            str(t.created_at),
            str(t.completed_at) if t.completed_at else "",
            t.location or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks_export.csv"},
    )


@router.get("/analytics/json", response_model=AnalyticsExportResponse)
async def export_analytics_json(
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> AnalyticsExportResponse:
    """Export analytics data as JSON."""
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow().date() - timedelta(days=days)
    analytics = (
        db.query(UserAnalytics)
        .filter(UserAnalytics.user_id == current_user.id, UserAnalytics.date >= cutoff)
        .order_by(UserAnalytics.date.asc())
        .all()
    )

    data_items = [
        AnalyticsExportItem(
            date=a.date.isoformat(),
            tasks_created=a.tasks_created,
            tasks_completed=a.tasks_completed,
            tasks_overdue=a.tasks_overdue,
            pomodoro_sessions=a.pomodoro_sessions,
            active_minutes=a.active_minutes,
            productivity_score=a.productivity_score,
        )
        for a in analytics
    ]
    return AnalyticsExportResponse(
        exported_at=date.today().isoformat(),
        user=current_user.username,
        period_days=days,
        data=data_items,
    )
