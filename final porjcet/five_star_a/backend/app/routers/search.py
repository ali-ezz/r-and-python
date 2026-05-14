"""Advanced search API - full-text search across tasks and projects."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    id: UUID
    type: str
    title: str
    subtitle: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    tasks: list[SearchResult]
    projects: list[SearchResult]
    total: int


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SearchResponse:
    """Search across tasks and projects."""
    search_pattern = f"%{q}%"

    # Search tasks
    tasks = (
        db.query(Task)
        .filter(
            or_(
                Task.title.ilike(search_pattern),
                Task.description.ilike(search_pattern),
            ),
            or_(
                Task.created_by == current_user.id,
                Task.assigned_to == current_user.id,
            ),
        )
        .order_by(Task.updated_at.desc())
        .limit(limit)
        .all()
    )

    # Search projects
    projects = (
        db.query(Project)
        .filter(
            or_(
                Project.name.ilike(search_pattern),
                Project.description.ilike(search_pattern),
            ),
            Project.created_by == current_user.id,
        )
        .order_by(Project.updated_at.desc())
        .limit(limit)
        .all()
    )

    task_results = [
        SearchResult(
            id=t.id,
            type="task",
            title=t.title,
            subtitle=f"{t.status.value if hasattr(t.status, 'value') else t.status} · {t.priority.value if hasattr(t.priority, 'value') else t.priority}",
        )
        for t in tasks
    ]

    project_results = [
        SearchResult(
            id=p.id,
            type="project",
            title=p.name,
            subtitle=p.description[:100] if p.description else None,
        )
        for p in projects
    ]

    total = len(task_results) + len(project_results)

    return SearchResponse(query=q, tasks=task_results, projects=project_results, total=total)
