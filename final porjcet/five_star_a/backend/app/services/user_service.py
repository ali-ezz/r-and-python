from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserUpdate
from app.services import cache_service


USER_CACHE_DOMAIN = "users"


def _user_to_dict(user: User) -> dict:
	return {
		"id": str(user.id),
		"email": user.email,
		"username": user.username,
		"full_name": user.full_name,
		"avatar_url": user.avatar_url,
		"role": user.role.value if hasattr(user.role, "value") else str(user.role),
		"is_active": user.is_active,
		"is_verified": user.is_verified,
		"created_at": user.created_at.isoformat() if user.created_at else None,
		"last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
		"two_factor_enabled": user.two_factor_enabled,
		"preferences": user.preferences or {},
		"timezone": user.timezone,
	}


def invalidate_user_cache() -> None:
	cache_service.clear_domain(USER_CACHE_DOMAIN)


def list_users(
	db: Session, *, workspace_id: UUID, skip: int = 0, limit: int = 50
) -> tuple[list[User], int]:
	cache_key = f"{USER_CACHE_DOMAIN}:list:{workspace_id}:{skip}:{limit}"
	cached = cache_service.get_json(cache_key)
	if cached is not None:
		return cached["users"], cached["total"]

	query = db.query(User).filter(User.workspace_id == workspace_id)
	total = query.count()
	users = query.offset(skip).limit(limit).all()
	cache_service.set_json(
		cache_key,
		{"users": [_user_to_dict(user) for user in users], "total": total},
		ttl_seconds=120,
	)
	return users, total


def get_user_by_id(db: Session, user_id: UUID) -> User:
	user = db.query(User).filter(User.id == user_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
	return user


def search_users(
	db: Session, q: str, *, workspace_id: UUID, skip: int = 0, limit: int = 20
) -> tuple[list[User], int]:
	cache_key = f"{USER_CACHE_DOMAIN}:search:{workspace_id}:{q}:{skip}:{limit}"
	cached = cache_service.get_json(cache_key)
	if cached is not None:
		return cached["users"], cached["total"]

	query = db.query(User).filter(
		User.workspace_id == workspace_id,
		or_(User.username.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")),
	)
	total = query.count()
	users = query.offset(skip).limit(limit).all()
	cache_service.set_json(
		cache_key,
		{"users": [_user_to_dict(user) for user in users], "total": total},
		ttl_seconds=120,
	)
	return users, total


def update_user(db: Session, user: User, payload: UserUpdate) -> User:
	data = payload.model_dump(exclude_unset=True)
	for key, value in data.items():
		if key in ['email', 'username']:
			existing = db.query(User).filter(getattr(User, key) == value, User.id != user.id).first()
			if existing:
				raise HTTPException(status_code=400, detail=f"{key.capitalize()} already registered")
		# Convert Pydantic models to dict for JSON columns
		if key == "preferences" and hasattr(value, "model_dump"):
			value = value.model_dump()
		# Convert role string to enum
		if key == "role" and isinstance(value, str):
			from app.models.user import UserRole
			try:
				value = UserRole(value)
			except ValueError:
				continue  # Skip invalid role values
		# Hash password if provided — write to 'hashed_password' column, not 'password'
		if key == "password" and isinstance(value, str):
			from app.utils.security import get_password_hash
			user.hashed_password = get_password_hash(value)
			continue
		setattr(user, key, value)
	db.commit()
	db.refresh(user)
	invalidate_user_cache()
	return user


def delete_user(db: Session, user_id: UUID) -> None:
	user = db.query(User).filter(User.id == user_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

	# Import models for cascade deletion
	from app.models.task import Task, TaskComment, TaskAttachment
	from app.models.notification import Notification
	from app.models.team_chat import TeamChatMessage
	from app.models.project import Project, ProjectMember

	# 1. Delete tasks created by this user (cascade)
	db.query(TaskAttachment).filter(TaskAttachment.task_id.in_(
		db.query(Task.id).filter(Task.created_by == user_id)
	)).delete(synchronize_session=False)
	db.query(TaskComment).filter(TaskComment.task_id.in_(
		db.query(Task.id).filter(Task.created_by == user_id)
	)).delete(synchronize_session=False)
	db.query(Notification).filter(Notification.related_task_id.in_(
		db.query(Task.id).filter(Task.created_by == user_id)
	)).delete(synchronize_session=False)
	db.query(Task).filter(Task.created_by == user_id).delete(synchronize_session=False)

	# 2. Unassign tasks (set assigned_to to None - this field IS nullable)
	db.query(Task).filter(Task.assigned_to == user_id).update({"assigned_to": None}, synchronize_session=False)

	# 3. Delete projects created by this user (cascade handles tasks within)
	db.query(ProjectMember).filter(ProjectMember.project_id.in_(
		db.query(Project.id).filter(Project.created_by == user_id)
	)).delete(synchronize_session=False)
	db.query(Project).filter(Project.created_by == user_id).delete(synchronize_session=False)

	# 4. Delete user's notifications, chat messages, comments, attachments
	db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
	db.query(TeamChatMessage).filter(TeamChatMessage.user_id == user_id).delete(synchronize_session=False)
	db.query(TaskComment).filter(TaskComment.user_id == user_id).delete(synchronize_session=False)
	db.query(TaskAttachment).filter(TaskAttachment.uploaded_by == user_id).delete(synchronize_session=False)

	# 5. Delete project memberships (simple filter, no or_ needed)
	db.query(ProjectMember).filter(ProjectMember.user_id == user_id).delete(synchronize_session=False)

	# 6. Delete related records from other tables
	from app.models.device import Device, RefreshToken

	db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
	db.query(Device).filter(Device.user_id == user_id).delete(synchronize_session=False)

	# 7. Finally delete the user
	db.delete(user)
	db.commit()
	invalidate_user_cache()
