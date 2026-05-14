from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, constr


class ProjectBase(BaseModel):
    name: constr(min_length=1, max_length=300)
    description: Optional[str] = None
    color: constr(pattern=r"^#[0-9A-Fa-f]{6}$") = "#000000"
    icon: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[constr(min_length=1, max_length=300)] = None
    description: Optional[str] = None
    color: Optional[constr(pattern=r"^#[0-9A-Fa-f]{6}$")] = None
    icon: Optional[str] = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    color: str
    icon: Optional[str] = None
    created_by: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    task_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
