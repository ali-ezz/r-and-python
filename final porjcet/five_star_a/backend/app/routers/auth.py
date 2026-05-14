from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import OAuthAccount, OAuthProvider, User
from app.schemas.auth import (
	LoginRequest,
	OAuth2LoginRequest,
	RefreshTokenRequest,
	RegisterRequest,
	RegisterResponse,
	Token,
	TwoFactorSetupResponse,
	TwoFactorVerifyRequest,
	PasswordChangeRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse
from app.services import auth_service
from app.utils.dependencies import get_current_active_user
from app.utils.security import verify_google_oauth_code

router = APIRouter(prefix="/auth", tags=["auth"])


class DeviceLogoutRequest(BaseModel):
	device_id: Optional[UUID] = None


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
	user = auth_service.register_user(db, payload)
	token = auth_service.issue_token_pair(db, user)
	return RegisterResponse(user=UserResponse.model_validate(user), token=token)




@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
	user = auth_service.authenticate_user(db, payload)
	return auth_service.issue_token_pair(db, user)

@router.post("/swagger", response_model=Token, include_in_schema=False)
def swagger_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
) -> Token:
        """Endpoint specifically for FastAPI Swagger UI authorization."""
        payload = LoginRequest(username=username, password=password)
        user = auth_service.authenticate_user(db, payload)
        return auth_service.issue_token_pair(db, user)

@router.post("/oauth", response_model=Token)
async def oauth_login(payload: OAuth2LoginRequest, db: Session = Depends(get_db)) -> Token:
	if payload.provider.lower() != "google":
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only google OAuth is supported")

	oauth_data = await verify_google_oauth_code(payload.code, payload.redirect_uri)
	email = oauth_data.get("email") or f"google_{secrets.token_hex(4)}@oauth.local"
	username = email.split("@")[0]
	# Ensure minimum username length
	if len(username) < 3:
		username = f"{username}{secrets.token_urlsafe(3 - len(username))}"

	user = db.query(User).filter(User.email == email).first()
	is_new_user = False
	if not user:
		is_new_user = True
		fake_password = secrets.token_urlsafe(16)
		user = auth_service.register_user(
			db,
			RegisterRequest(
				email=email,
				username=username,
				password=fake_password,
				confirm_password=fake_password,
				full_name=oauth_data.get("name"),
			),
		)

	# Create or update OAuthAccount record
	provider_enum = OAuthProvider.google
	oauth_account = db.query(OAuthAccount).filter(
		OAuthAccount.user_id == user.id,
		OAuthAccount.provider == provider_enum,
	).first()

	expires_at = datetime.utcnow() + timedelta(seconds=oauth_data.get("expires_in", 3600))

	if oauth_account:
		oauth_account.access_token = oauth_data.get("access_token")
		oauth_account.refresh_token = oauth_data.get("refresh_token")
		oauth_account.expires_at = expires_at
		oauth_account.updated_at = datetime.utcnow()
	else:
		oauth_account = OAuthAccount(
			user_id=user.id,
			provider=provider_enum,
			provider_user_id=oauth_data.get("sub", email),
			access_token=oauth_data.get("access_token"),
			refresh_token=oauth_data.get("refresh_token"),
			expires_at=expires_at,
		)
		db.add(oauth_account)

	db.commit()

	# Update user profile picture if new user and picture available
	if is_new_user and oauth_data.get("picture") and not user.avatar_url:
		user.avatar_url = oauth_data["picture"]
		db.commit()

	return auth_service.issue_token_pair(db, user)


@router.post("/refresh", response_model=Token)
def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> Token:
	return auth_service.refresh_access_token(db, payload.refresh_token)


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_two_factor(
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> TwoFactorSetupResponse:
	return auth_service.setup_two_factor(db, current_user)


@router.post("/2fa/verify", response_model=MessageResponse)
def verify_two_factor(
	payload: TwoFactorVerifyRequest,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
	valid = auth_service.verify_two_factor(db, current_user, payload.code)
	if not valid:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code")
	return MessageResponse(message="2FA enabled successfully")


@router.post("/logout/device", response_model=MessageResponse)
def logout_device(
	payload: DeviceLogoutRequest,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
	if payload.device_id is None:
		# Logout all devices - revoke all refresh tokens for this user
		revoked = auth_service.logout_all_devices(db, current_user)
		return MessageResponse(message="Revoked all devices")
	else:
		revoked = auth_service.logout_remote_device(db, current_user, payload.device_id)
		return MessageResponse(message=f"Revoked {revoked} token(s) for the selected device")


# ─── Password Reset (no email needed) ────────────────────────────────────

class PasswordResetViaRecoveryKey(BaseModel):
	username: str
	recovery_key: str
	new_password: str
	confirm_password: str


class PasswordResetViaTOTP(BaseModel):
	username: str
	totp_code: str
	new_password: str
	confirm_password: str


@router.post("/password/reset/recovery-key", response_model=MessageResponse)
def reset_password_via_recovery_key(
	payload: PasswordResetViaRecoveryKey,
	db: Session = Depends(get_db),
) -> MessageResponse:
	"""Reset password using a 2FA backup/recovery key (no login required)."""
	from app.utils.security import get_password_hash

	if payload.new_password != payload.confirm_password:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
	if len(payload.new_password) < 8:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

	user = db.query(User).filter(
		(User.username == payload.username.strip().lower()) | (User.email == payload.username.strip().lower())
	).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
	if not user.two_factor_enabled or not user.two_factor_secret:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled for this account")

	# Verify recovery key matches one of the backup codes stored in 2FA setup
	# Backup codes are not persisted separately, so we validate the key format
	# and trust the user who set up 2FA has their backup codes
	# For production: store hashed backup codes in DB. For this project, accept the 2FA secret itself as recovery key.
	if payload.recovery_key.strip().upper().replace(" ", "") != user.two_factor_secret.upper():
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recovery key")

	user.hashed_password = get_password_hash(payload.new_password)
	db.commit()
	return MessageResponse(message="Password reset successfully")


@router.post("/password/reset/totp", response_model=MessageResponse)
def reset_password_via_totp(
	payload: PasswordResetViaTOTP,
	db: Session = Depends(get_db),
) -> MessageResponse:
	"""Reset password using a 6-digit authenticator app code (no login required)."""
	from app.utils.security import get_password_hash, verify_totp_code

	if payload.new_password != payload.confirm_password:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
	if len(payload.new_password) < 8:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

	user = db.query(User).filter(
		(User.username == payload.username.strip().lower()) | (User.email == payload.username.strip().lower())
	).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
	if not user.two_factor_enabled or not user.two_factor_secret:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled for this account")

	if not verify_totp_code(user.two_factor_secret, payload.totp_code):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authenticator code")

	user.hashed_password = get_password_hash(payload.new_password)
	db.commit()
	return MessageResponse(message="Password reset successfully")
