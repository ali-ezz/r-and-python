import os
import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.auth import RegisterRequest, RegisterResponse
from app.schemas.user import AvatarUploadResponse, UserListResponse, UserResponse, UserUpdate
from app.services import auth_service, user_service
from app.utils.dependencies import get_current_active_user, require_admin

router = APIRouter(prefix="/users", tags=["users"])

# Same layout as app/main.py STATIC_DIR — uploads must land where StaticFiles is served from.
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_AVATARS_DIR = os.path.join(_BACKEND_ROOT, "static", "avatars")


def _role_value(user: User) -> str:
	"""Extract role as a plain string from the user object."""
	return user.role.value if hasattr(user.role, "value") else str(user.role)


def _is_admin(user: User) -> bool:
	return _role_value(user) == "admin"


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(
	payload: RegisterRequest,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_admin),
) -> dict:
	user = auth_service.register_user(db, payload, inviting_workspace_id=current_user.workspace_id)
	token = auth_service.issue_token_pair(db, user)
	return {"user": {"id": str(user.id), "email": user.email, "username": user.username, "role": _role_value(user)}, "token": token}


@router.get("", response_model=UserListResponse)
def list_all_users(
	page: int = Query(1, ge=1),
	page_size: int = Query(20, ge=1, le=200),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> UserListResponse:

	skip = (page - 1) * page_size
	users, total = user_service.list_users(
		db, workspace_id=current_user.workspace_id, skip=skip, limit=page_size
	)
	return UserListResponse(users=[UserResponse.model_validate(user) for user in users], total=total, page=page, page_size=page_size)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)) -> UserResponse:
	return UserResponse.model_validate(current_user)


@router.get("/search", response_model=UserListResponse)
def search_users(
	q: str,
	page: int = Query(1, ge=1),
	page_size: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> UserListResponse:
	skip = (page - 1) * page_size
	users, total = user_service.search_users(
		db, q=q, workspace_id=current_user.workspace_id, skip=skip, limit=page_size
	)
	return UserListResponse(users=[UserResponse.model_validate(user) for user in users], total=total, page=page, page_size=page_size)


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
	user_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> UserResponse:
	user = user_service.get_user_by_id(db, user_id)
	if user.workspace_id != current_user.workspace_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
	return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
	user_id: UUID,
	payload: UserUpdate,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> UserResponse:
	if current_user.id != user_id and not _is_admin(current_user):
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user")
	
	if payload.role is not None and not _is_admin(current_user):
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can change roles")

	user = user_service.get_user_by_id(db, user_id)
	if user.workspace_id != current_user.workspace_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
	updated = user_service.update_user(db, user, payload)
	return UserResponse.model_validate(updated)


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
	user_id: UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_admin),
) -> MessageResponse:
	if current_user.id == user_id:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

	target = user_service.get_user_by_id(db, user_id)
	if target.workspace_id != current_user.workspace_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

	try:
		user_service.delete_user(db, user_id)
		return MessageResponse(message="User deleted successfully")
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to delete user: {str(e)}")


@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
	avatar: UploadFile = File(...),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> AvatarUploadResponse:
	# Handle missing filename
	if not avatar.filename:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

	# Validate file extension
	allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
	ext = avatar.filename.rsplit(".", 1)[-1].lower() if "." in avatar.filename else "png"
	if ext not in allowed_extensions:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File type not allowed. Allowed: {', '.join(allowed_extensions)}")

	# Generate unique filename
	filename = f"{uuid.uuid4().hex}.{ext}"

	os.makedirs(_AVATARS_DIR, exist_ok=True)

	# Save file
	filepath = os.path.join(_AVATARS_DIR, filename)
	with open(filepath, "wb") as f:
		content = await avatar.read()
		f.write(content)

	url = f"/static/avatars/{filename}"
	current_user.avatar_url = url
	db.commit()
	user_service.invalidate_user_cache()
	return AvatarUploadResponse(message="Profile picture uploaded successfully", avatar_url=url)
