from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, constr


class TeamChatMessageCreate(BaseModel):
    content: constr(min_length=1, max_length=2000)


class TeamChatMessageResponse(BaseModel):
    id: UUID
    user_id: UUID
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamChatMessageListResponse(BaseModel):
    messages: list[TeamChatMessageResponse]
    total: int
