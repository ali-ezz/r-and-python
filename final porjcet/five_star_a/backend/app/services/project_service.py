from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services import cache_service


PROJECT_CACHE_DOMAIN = "projects"


def _project_to_dict(project: Project) -> dict:
	return {
		"id": str(project.id),
		"name": project.name,
		"description": project.description,
		"color": project.color,
		"icon": project.icon,
		"created_by": str(project.created_by),
		"is_active": project.is_active,
		"created_at": project.created_at.isoformat() if project.created_at else None,
		"updated_at": project.updated_at.isoformat() if project.updated_at else None,
		"task_count": len(project.tasks) if getattr(project, "tasks", None) is not None else 0,
	}


def invalidate_project_cache() -> None:
	cache_service.clear_domain(PROJECT_CACHE_DOMAIN)


def list_projects(
	db: Session,
	*,
	workspace_id: UUID,
	role: str,
	skip: int = 0,
	limit: int = 50,
) -> tuple[list[Project], int]:
	cache_key = f"{PROJECT_CACHE_DOMAIN}:list:{workspace_id}:{role}:{skip}:{limit}"
	cached = cache_service.get_json(cache_key)
	if cached is not None:
		return cached["projects"], cached["total"]

	query = db.query(Project).filter(Project.workspace_id == workspace_id)

	if role == "employee":
		return [], 0

	total = query.count()
	projects = query.offset(skip).limit(limit).all()
	cache_service.set_json(
		cache_key,
		{"projects": [_project_to_dict(project) for project in projects], "total": total},
		ttl_seconds=120,
	)
	return projects, total


def get_project(db: Session, project_id: UUID) -> Project:
	project = db.query(Project).filter(Project.id == project_id).first()
	if not project:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
	return project


def create_project(db: Session, user_id: UUID, workspace_id: UUID, payload: ProjectCreate) -> Project:
	project = Project(created_by=user_id, workspace_id=workspace_id, **payload.model_dump())
	db.add(project)
	db.commit()
	db.refresh(project)
	invalidate_project_cache()
	return project


def update_project(db: Session, project: Project, payload: ProjectUpdate) -> Project:
	data = payload.model_dump(exclude_unset=True)
	for key, value in data.items():
		setattr(project, key, value)
	db.commit()
	db.refresh(project)
	invalidate_project_cache()
	return project


def delete_project(db: Session, project: Project) -> None:
	db.delete(project)
	db.commit()
	invalidate_project_cache()


def list_templates(
	db: Session, workspace_id: UUID, skip: int = 0, limit: int = 50
) -> tuple[list[Project], int]:
	cache_key = f"{PROJECT_CACHE_DOMAIN}:templates:{workspace_id}:{skip}:{limit}"
	cached = cache_service.get_json(cache_key)
	if cached is not None:
		return cached["projects"], cached["total"]

	query = db.query(Project).filter(
		Project.is_template.is_(True),
		Project.workspace_id == workspace_id,
	)
	total = query.count()
	templates = query.offset(skip).limit(limit).all()
	cache_service.set_json(
		cache_key,
		{"projects": [_project_to_dict(project) for project in templates], "total": total},
		ttl_seconds=120,
	)
	return templates, total


def duplicate_project(db: Session, project: Project, user_id: UUID) -> Project:
	duplicate = Project(
		name=f"{project.name} (Copy)",
		description=project.description,
		color=project.color,
		icon=project.icon,
		created_by=user_id,
		workspace_id=project.workspace_id,
		settings=project.settings or {},
		is_template=False,
		template_category=project.template_category,
	)
	db.add(duplicate)
	db.commit()
	db.refresh(duplicate)
	invalidate_project_cache()
	return duplicate
