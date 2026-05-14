from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.analytics_focus import (
    ViewTypeItem,
    ViewConfig,
    ViewDefinitionResponse,
    DashboardSummaryResponse,
    TaskStats,
)
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/views", tags=["views"])

VIEW_TYPES = [
	"list",
	"kanban",
	"grid",
	"planner",
	"skyline",
	"calendar",
	"stream",
	"matrix",
	"workload",
	"map",
]


@router.get("", response_model=list[ViewTypeItem])
def list_view_types() -> list[ViewTypeItem]:
	return [ViewTypeItem(key=view_type, enabled=True) for view_type in VIEW_TYPES]


@router.get("/{view_type}", response_model=ViewDefinitionResponse)
def get_view_definition(view_type: str) -> ViewDefinitionResponse:
	if view_type not in VIEW_TYPES:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View type not found")

	return ViewDefinitionResponse(
		view=view_type,
		config=ViewConfig(
			sortable=True,
			filterable=True,
			groupable=view_type in {"kanban", "matrix", "workload"},
		),
		status="available",
	)


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> DashboardSummaryResponse:
	role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
	now = datetime.utcnow()

	if role == "admin":
		project_query = db.query(Project)
		task_query = db.query(Task)
	else:
		project_query = db.query(Project).filter(Project.created_by == current_user.id)
		task_query = db.query(Task).filter(or_(Task.created_by == current_user.id, Task.assigned_to == current_user.id))

	total_projects = project_query.count()
	total_tasks = task_query.count()
	tasks_done = task_query.filter(Task.status == TaskStatus.done).count()
	tasks_in_progress = task_query.filter(Task.status == TaskStatus.in_progress).count()
	tasks_todo = task_query.filter(Task.status == TaskStatus.todo).count()
	overdue = task_query.filter(and_(Task.due_date.isnot(None), Task.due_date < now, Task.status != TaskStatus.done)).count()
	due_today = task_query.filter(and_(Task.due_date.isnot(None), func.date(Task.due_date) == func.current_date())).count()

	priority_rows = task_query.with_entities(Task.priority, func.count(Task.id)).group_by(Task.priority).all()
	by_priority = {str(key): count for key, count in priority_rows}

	completion_rate = round((tasks_done / total_tasks), 4) if total_tasks else 0.0

	return DashboardSummaryResponse(
		projects=total_projects,
		tasks=TaskStats(
			total=total_tasks,
			todo=tasks_todo,
			in_progress=tasks_in_progress,
			done=tasks_done,
			overdue=overdue,
			due_today=due_today,
			completion_rate=completion_rate,
			by_priority=by_priority,
		),
	)
