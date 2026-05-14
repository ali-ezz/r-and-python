from __future__ import annotations

from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageResponse(BaseModel):
    message: str


class Pagination(BaseModel):
    page: int = 1
    page_size: int = 20
    total: int = 0


class TimestampedSchema(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
