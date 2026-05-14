from __future__ import annotations

from typing import Optional
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models.device import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, Token, TwoFactorSetupResponse
from app.services import cache_service
from app.utils.security import (
	create_access_token,
	create_refresh_token,
	generate_backup_codes,
	generate_qr_code,
	generate_totp_secret,
	get_password_hash,
	verify_password,
	verify_totp_code,
)


def _role_value(user: User) -> str:
	return user.role.value if hasattr(user.role, "value") else str(user.role)


def register_user(
	db: Session,
	payload: RegisterRequest,
	*,
	inviting_workspace_id: Optional[UUID] = None,
) -> User:
	# Normalize inputs - strip whitespace, lowercase email
	email = payload.email.strip().lower()
	username = payload.username.strip().lower()
	full_name = payload.full_name.strip() if payload.full_name else None

	existing_user = db.query(User).filter(or_(User.email == email, User.username == username)).first()
	if existing_user:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or username already exists")

	from app.models.user import UserRole
	from app.models.workspace import Workspace

	if inviting_workspace_id is None:
		# Self-service signup: new isolated workspace; user is admin of that workspace only.
		ws = Workspace(name=(full_name or username or "My workspace")[:200])
		db.add(ws)
		db.flush()
		workspace_id = ws.id
		role = UserRole.admin
	else:
		workspace_id = inviting_workspace_id
		role_str = payload.role if payload.role else UserRole.employee.value
		try:
			role = UserRole(role_str)
		except ValueError:
			role = UserRole.employee

	user = User(
		email=email,
		username=username,
		full_name=full_name,
		hashed_password=get_password_hash(payload.password),
		workspace_id=workspace_id,
		role=role,
		is_active=True,
		is_verified=True,
	)
	db.add(user)
	db.commit()
	db.refresh(user)
	cache_service.clear_domain("users")
	return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
	# Normalize login input - strip whitespace, lowercase for comparison
	login_input = payload.username.strip().lower()
	user = db.query(User).filter(
		or_(User.username == login_input, User.email == login_input)
	).first()
	if not user or not verify_password(payload.password, user.hashed_password):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
	if not user.is_active:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

	user.last_login_at = datetime.utcnow()
	db.commit()
	db.refresh(user)
	return user


def issue_token_pair(db: Session, user: User, device_id: Optional[UUID] = None) -> Token:
	access_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
	refresh_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

	payload = {
		"sub": str(user.id),
		"user_id": str(user.id),
		"username": user.username,
		"email": user.email,
		"role": _role_value(user),
	}
	access_token = create_access_token(payload, expires_delta=access_expires)
	refresh_token = create_refresh_token(payload, expires_delta=refresh_expires)

	db_token = RefreshToken(
		user_id=user.id,
		token=refresh_token,
		device_id=device_id,
		expires_at=datetime.utcnow() + refresh_expires,
		revoked=False,
	)
	db.add(db_token)
	db.commit()

	return Token(
		access_token=access_token,
		expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
		refresh_token=refresh_token,
	)


def refresh_access_token(db: Session, refresh_token: str) -> Token:
	db_token = (
		db.query(RefreshToken)
		.filter(RefreshToken.token == refresh_token, RefreshToken.revoked.is_(False))
		.first()
	)
	if not db_token or db_token.expires_at < datetime.utcnow():
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or expired")

	user = db.query(User).filter(User.id == db_token.user_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

	payload = {
		"sub": str(user.id),
		"user_id": str(user.id),
		"username": user.username,
		"email": user.email,
		"role": _role_value(user),
	}
	access_token = create_access_token(payload)

	return Token(
		access_token=access_token,
		expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
		refresh_token=refresh_token,
	)


def setup_two_factor(db: Session, user: User) -> TwoFactorSetupResponse:
	secret = generate_totp_secret()
	qr_code_url = generate_qr_code(secret, user.email)
	backup_codes = generate_backup_codes()

	user.two_factor_secret = secret
	db.commit()
	db.refresh(user)

	return TwoFactorSetupResponse(secret=secret, qr_code_url=qr_code_url, backup_codes=backup_codes)


def verify_two_factor(db: Session, user: User, code: str) -> bool:
	if not user.two_factor_secret:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA is not configured")

	if not verify_totp_code(user.two_factor_secret, code):
		return False

	user.two_factor_enabled = True
	db.commit()
	return True


def logout_all_devices(db: Session, user: User) -> int:
	"""Revoke all refresh tokens for a user (logout from all devices)."""
	updated = (
		db.query(RefreshToken)
		.filter(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
		.update({"revoked": True})
	)
	db.commit()
	return int(updated)


def logout_remote_device(db: Session, user: User, device_id: UUID) -> int:
	updated = (
		db.query(RefreshToken)
		.filter(RefreshToken.user_id == user.id, RefreshToken.device_id == device_id, RefreshToken.revoked.is_(False))
		.update({"revoked": True})
	)
	db.commit()
	return int(updated)
