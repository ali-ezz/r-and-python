from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, constr


class UserBase(BaseModel):
    email: str
    username: constr(min_length=3, max_length=100)
    full_name: Optional[str] = None


class UserPreferences(BaseModel):
    theme: str = "light"
    language: str = "en"
    timezone: str = "UTC"
    notifications: dict = Field(default_factory=dict)
    default_view: str = "list"


class UserCreate(UserBase):
    password: constr(min_length=8)


class AvatarUploadResponse(BaseModel):
    message: str
    avatar_url: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[UserPreferences] = None
    timezone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[constr(min_length=8)] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    two_factor_enabled: bool
    preferences: dict = Field(default_factory=dict)
    timezone: str

    model_config = ConfigDict(from_attributes=True)


class UserPublicProfile(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


class UserStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    productivity_score: float
    current_streak: int
