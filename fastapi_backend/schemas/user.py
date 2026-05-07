"""Pydantic schemas for user registration and responses."""

from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from uuid import UUID
from typing import Optional
from datetime import datetime
import re

from app.models.user import RoleEnum


class UserBase(BaseModel):
    """Base schema with email."""
    email: EmailStr


class UserCreate(UserBase):
    """Registration payload with password validation."""
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Enforce password complexity: 8+ chars, 1 upper, 1 digit."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(UserBase):
    """Public user response."""
    id: UUID
    full_name: Optional[str] = None
    role: RoleEnum
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    """Admin: update user role or status."""
    full_name: Optional[str] = Field(None, max_length=100)
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    department: Optional[str] = Field(None, min_length=1, max_length=100)
    enrollment_year: Optional[str] = Field(None, min_length=4, max_length=4)
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)

    model_config = ConfigDict(from_attributes=True)


class UserCreateAdmin(UserCreate):
    """Admin: create any account type, optionally with a student profile."""
    role: RoleEnum = RoleEnum.STUDENT
    is_active: bool = True
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    department: Optional[str] = Field(None, min_length=1, max_length=100)
    enrollment_year: Optional[str] = Field(None, min_length=4, max_length=4)
    gpa: Optional[float] = Field(0.0, ge=0.0, le=4.0)

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(UserResponse):
    """Extended response with student profile data for admin views."""
    student_first_name: Optional[str] = None
    student_last_name: Optional[str] = None
    student_department: Optional[str] = None
    student_gpa: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
