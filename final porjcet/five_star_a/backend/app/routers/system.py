"""System monitoring endpoints for the project dashboard and Prometheus."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.logging import get_request_metrics
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services import cache_service
from app.utils.dependencies import require_admin

router = APIRouter(prefix="/system", tags=["system"])


def _database_status(db: Session) -> str:
	try:
		db.execute(text("SELECT 1"))
		return "up"
	except Exception:
		return "down"


def _counts(db: Session) -> dict:
	status_counts = {
		status.value: db.query(func.count(Task.id)).filter(Task.status == status).scalar() or 0
		for status in TaskStatus
	}
	return {
		"users": db.query(func.count(User.id)).scalar() or 0,
		"projects": db.query(func.count(Project.id)).scalar() or 0,
		"tasks": {
			"total": db.query(func.count(Task.id)).scalar() or 0,
			"by_status": status_counts,
			"overdue": db.query(func.count(Task.id))
			.filter(Task.due_date.isnot(None), Task.due_date < datetime.utcnow(), Task.status != TaskStatus.done)
			.scalar()
			or 0,
		},
	}


@router.get("/dashboard")
def monitoring_dashboard(
	db: Session = Depends(get_db),
	_admin: User = Depends(require_admin),
) -> dict:
	"""Admin-only monitoring dashboard data."""
	return {
		"services": {
			"api": "up",
			"database": _database_status(db),
			"cache": cache_service.health(),
		},
		"requests": get_request_metrics(),
		"cache": cache_service.stats(),
		"counts": _counts(db),
	}


@router.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics(db: Session = Depends(get_db)) -> PlainTextResponse:
	"""Simple Prometheus-compatible metrics endpoint."""
	requests = get_request_metrics()
	cache = cache_service.stats()
	counts = _counts(db)

	lines = [
		"# HELP tms_http_requests_total Total HTTP requests observed by the app",
		"# TYPE tms_http_requests_total counter",
		f"tms_http_requests_total {requests['total_requests']}",
		"# HELP tms_http_errors_total Total HTTP 5xx requests observed by the app",
		"# TYPE tms_http_errors_total counter",
		f"tms_http_errors_total {requests['error_requests']}",
		"# HELP tms_http_request_latency_average_ms Average HTTP latency in milliseconds",
		"# TYPE tms_http_request_latency_average_ms gauge",
		f"tms_http_request_latency_average_ms {requests['average_latency_ms']}",
		"# HELP tms_cache_hit_ratio Cache hit ratio",
		"# TYPE tms_cache_hit_ratio gauge",
		f"tms_cache_hit_ratio {cache['hit_ratio']}",
		"# HELP tms_users_total Total users",
		"# TYPE tms_users_total gauge",
		f"tms_users_total {counts['users']}",
		"# HELP tms_projects_total Total projects",
		"# TYPE tms_projects_total gauge",
		f"tms_projects_total {counts['projects']}",
		"# HELP tms_tasks_total Total tasks",
		"# TYPE tms_tasks_total gauge",
		f"tms_tasks_total {counts['tasks']['total']}",
	]

	for status, value in counts["tasks"]["by_status"].items():
		lines.append(f'tms_tasks_by_status{{status="{status}"}} {value}')

	return PlainTextResponse("\n".join(lines) + "\n")
