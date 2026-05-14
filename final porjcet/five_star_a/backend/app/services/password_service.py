"""Password reset service with token generation and validation."""

from __future__ import annotations

from typing import Optional
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.utils.security import create_access_token, decode_token, get_password_hash, verify_password

RESET_TOKEN_PREFIX = "pwd_reset_"

# In-memory token store for development (no SMTP)
# In production, tokens would be sent via email and stored in a database table
_reset_tokens: dict[str, str] = {}


def generate_reset_token(db: Session, email: str) -> str:
    """Generate a password reset token for a user."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return RESET_TOKEN_PREFIX + secrets.token_urlsafe(32)

    payload = {
        "sub": str(user.id),
        "type": "password_reset",
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    token = RESET_TOKEN_PREFIX + create_access_token(payload, expires_delta=timedelta(hours=1))
    
    # Store token in memory for development/demo (replaces email delivery)
    _reset_tokens[email] = token
    
    return token


def get_stored_reset_token(email: str) -> Optional[str]:
    """Retrieve a stored reset token for development/demo purposes."""
    return _reset_tokens.get(email)


def verify_reset_token(token: str) -> str:
    """Verify a password reset token and return user ID."""
    if not token.startswith(RESET_TOKEN_PREFIX):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    raw_token = token[len(RESET_TOKEN_PREFIX):]
    try:
        payload = decode_token(raw_token)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")

    return user_id


def reset_password(db: Session, token: str, new_password: str) -> User:
    """Reset a user's password using a valid token."""
    user_id = verify_reset_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    """Change password for authenticated user."""
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    return user
