"""Pydantic schemas for authentication responses."""

from pydantic import BaseModel, ConfigDict, EmailStr
from uuid import UUID
from typing import Optional

from app.models.user import RoleEnum

class AuthProfile(BaseModel):
    """Student profile summary returned with auth user data."""
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    department: Optional[str] = None


class AuthUser(BaseModel):
    """User data returned in login/me responses."""
    id: UUID
    email: EmailStr
    role: RoleEnum
    isActive: bool
    fullName: Optional[str] = None
    profile: Optional[AuthProfile] = None

    model_config = ConfigDict(from_attributes=True)


class TokenData(BaseModel):
    """JWT token response payload."""
    accessToken: str


class LoginData(TokenData):
    """Login response with token and user data."""
    user: AuthUser


class LoginResponse(BaseModel):
    """Wrapper for login response."""
    data: LoginData


class MeData(BaseModel):
    """Current user response."""
    user: AuthUser


class MeResponse(BaseModel):
    """Wrapper for /me response."""
    data: MeData


class TokenResponse(BaseModel):
    """Wrapper for token refresh response."""
    data: TokenData


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
