from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project, ProjectMember, ProjectMemberRole
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.project import ProjectCreate, ProjectListResponse, ProjectResponse, ProjectUpdate
from app.services import project_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectShareRequest(BaseModel):
	emails: list[str] = Field(default_factory=list)
	role: str = "viewer"


def _role_value(user: User) -> str:
	"""Extract role as a plain string from the user object."""
	return user.role.value if hasattr(user.role, "value") else str(user.role)


def _require_admin(user: User, action: str = "modify projects") -> None:
	if _role_value(user) != "admin":
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail=f"Only workspace admins can {action}",
		)


def _require_not_employee(user: User):
	if _role_value(user) == "employee":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees cannot access projects")


def _project_in_workspace(project: Project, workspace_id: UUID) -> bool:
	return project.workspace_id == workspace_id


@router.get("", response_model=ProjectListResponse)
def list_projects(
	page: int = Query(1, ge=1),
	page_size: int = Query(20, ge=1, le=200),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> ProjectListResponse:
	skip = (page - 1) * page_size
	role = _role_value(current_user)
	projects, total = project_service.list_projects(
		db,
		workspace_id=current_user.workspace_id,
		role=role,
		skip=skip,
		limit=page_size,
	)
	return ProjectListResponse(projects=[ProjectResponse.model_validate(project) for project in projects], total=total)


@router.get("/templates", response_model=ProjectListResponse)
def list_templates(
	page: int = Query(1, ge=1),
	page_size: int = Query(20, ge=1, le=200),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> ProjectListResponse:
	skip = (page - 1) * page_size
	templates, total = project_service.list_templates(
		db, workspace_id=current_user.workspace_id, skip=skip, limit=page_size
	)
	return ProjectListResponse(projects=[ProjectResponse.model_validate(project) for project in templates], total=total)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
	payload: ProjectCreate,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> ProjectResponse:
	_require_not_employee(current_user)
	_require_admin(current_user, "create projects")
	project = project_service.create_project(db, current_user.id, current_user.workspace_id, payload)
	return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
	project_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> ProjectResponse:
	project = project_service.get_project(db, project_id)
	role = _role_value(current_user)
	if not _project_in_workspace(project, current_user.workspace_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
	if role == "employee":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
	return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
	project_id: UUID,
	payload: ProjectUpdate,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> ProjectResponse:
	project = project_service.get_project(db, project_id)
	if not _project_in_workspace(project, current_user.workspace_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
	_require_admin(current_user, "edit projects")

	updated = project_service.update_project(db, project, payload)
	return ProjectResponse.model_validate(updated)


@router.delete("/{project_id}", response_model=MessageResponse)
def delete_project(
	project_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
	project = project_service.get_project(db, project_id)
	if not _project_in_workspace(project, current_user.workspace_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
	_require_admin(current_user, "delete projects")

	project_service.delete_project(db, project)
	return MessageResponse(message="Project deleted successfully")


@router.post("/{project_id}/share", response_model=MessageResponse)
def share_project(
	project_id: UUID,
	payload: ProjectShareRequest,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
	project = project_service.get_project(db, project_id)
	if not _project_in_workspace(project, current_user.workspace_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
	_require_admin(current_user, "share projects")

	# Validate role
	try:
		role = ProjectMemberRole(payload.role)
	except ValueError:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role: {payload.role}")

	# Look up users by email
	users = db.query(User).filter(User.email.in_(payload.emails)).all()
	found_emails = {u.email for u in users}
	missing_emails = [e for e in payload.emails if e not in found_emails]

	added_count = 0
	for user in users:
		if user.workspace_id != project.workspace_id:
			continue
		if user.id == project.created_by:
			continue  # Skip project owner
		if user.id == current_user.id:
			continue  # Skip self

		# Check if already a member
		existing = db.query(ProjectMember).filter(
			ProjectMember.project_id == project_id,
			ProjectMember.user_id == user.id,
		).first()
		if existing:
			existing.role = role
			if role == ProjectMemberRole.editor:
				existing.can_edit = True
			elif role == ProjectMemberRole.owner:
				existing.can_edit = True
				existing.can_delete = True
		else:
			member = ProjectMember(
				project_id=project_id,
				user_id=user.id,
				role=role,
				can_edit=role == ProjectMemberRole.editor,
				can_delete=role == ProjectMemberRole.owner,
			)
			db.add(member)
			added_count += 1

	db.commit()
	project_service.invalidate_project_cache()

	message = f"Project shared with {added_count} user(s) as {role.value}"
	if missing_emails:
		message += f". Users not found: {', '.join(missing_emails)}"
	return MessageResponse(message=message)


@router.post("/{project_id}/duplicate", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def duplicate_project(
	project_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> ProjectResponse:
	source_project = project_service.get_project(db, project_id)
	if not _project_in_workspace(source_project, current_user.workspace_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
	_require_admin(current_user, "duplicate projects")
	duplicated = project_service.duplicate_project(db, source_project, current_user.id)
	return ProjectResponse.model_validate(duplicated)
