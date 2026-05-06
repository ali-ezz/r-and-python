"""Pydantic schemas for student data."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from uuid import UUID
from typing import Optional
from datetime import datetime


class StudentBase(BaseModel):
    """Base student fields shared by create and response."""
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    department: str = Field(..., min_length=1, max_length=100)
    enrollment_year: str = Field(..., min_length=4, max_length=4)
    gpa: Optional[float] = Field(0.0, ge=0.0, le=4.0)


class StudentCreate(StudentBase):
    """Student creation by the student themselves (user already exists)."""
    pass


class StudentCreateAdmin(StudentBase):
    """Admin-only: create a student with a new user account."""
    email: EmailStr
    password: str = Field(..., min_length=8)


class StudentUpdate(BaseModel):
    """Partial update for student profile."""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    department: Optional[str] = Field(None, min_length=1, max_length=100)
    enrollment_year: Optional[str] = Field(None, min_length=4, max_length=4)
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)


class StudentResponse(StudentBase):
    """Student response model with metadata."""
    id: UUID
    user_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
