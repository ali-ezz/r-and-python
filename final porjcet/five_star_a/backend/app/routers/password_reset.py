"""Password reset API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import PasswordChangeRequest, PasswordResetConfirm, PasswordResetRequest
from app.schemas.common import MessageResponse
from app.services import password_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/auth", tags=["auth-password"])


@router.post("/password-reset/request", response_model=MessageResponse)
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Request a password reset token."""
    token = password_service.generate_reset_token(db, payload.email)
    # In development: return the token so it can be used for testing/demo
    # In production: this would be sent via email and the response would be generic
    return MessageResponse(
        message=f"Password reset token generated. Use this token to reset your password: {token}"
    )


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Reset password with a valid token."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")

    password_service.reset_password(db, payload.token, payload.new_password)
    return MessageResponse(message="Password reset successfully")


@router.post("/password/change", response_model=MessageResponse)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Change password for authenticated user."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")

    password_service.change_password(db, current_user, payload.current_password, payload.new_password)
    return MessageResponse(message="Password changed successfully")
