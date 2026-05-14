"""Response schemas for analytics and focus endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# --- Analytics ---

class WeeklySummaryResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    completion_rate: float
    week_start: str
    week_end: str


class StreakInfoResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: Optional[str] = None


class ProductivityScoreResponse(BaseModel):
    score: float
    date: str


class MonthlyTrendEntry(BaseModel):
    date: str
    tasks_completed: int
    tasks_created: int
    productivity_score: float


class GoalCompletionResponse(BaseModel):
    total_goals: int
    completed_goals: int
    completion_rate: float
    period_days: int


# --- Focus / Goals ---

class DailyGoalResponse(BaseModel):
    id: UUID
    goal_text: str
    target_date: date
    is_completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DailyGoalListResponse(BaseModel):
    goals: list[DailyGoalResponse]


# --- Focus / Pomodoro ---

class PomodoroSessionResponse(BaseModel):
    id: UUID
    task_id: Optional[UUID] = None
    duration: int
    break_duration: int
    completed_cycles: int
    is_active: bool
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PomodoroActiveResponse(BaseModel):
    session: Optional[PomodoroSessionResponse] = None


class PomodoroHistoryResponse(BaseModel):
    sessions: list[PomodoroSessionResponse]


# --- Integrations ---

class IntegrationItem(BaseModel):
    id: str
    provider: str
    is_active: bool
    last_sync: Optional[str] = None


class IntegrationConnectResponse(BaseModel):
    id: str
    provider: str
    is_active: bool


# --- Spotify ---

class SpotifyTrackResponse(BaseModel):
    title: str
    artist: str
    album: Optional[str] = None
    album_art: Optional[str] = None
    url: Optional[str] = None
    playing_at: Optional[str] = None


class SpotifyRecentlyPlayedResponse(BaseModel):
    tracks: list[SpotifyTrackResponse]


# --- Views ---

class ViewTypeItem(BaseModel):
    key: str
    enabled: bool


class ViewConfig(BaseModel):
    sortable: bool
    filterable: bool
    groupable: bool


class ViewDefinitionResponse(BaseModel):
    view: str
    config: ViewConfig
    status: str


class TaskStats(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    overdue: int
    due_today: int
    completion_rate: float
    by_priority: dict[str, int]


class DashboardSummaryResponse(BaseModel):
    projects: int
    tasks: TaskStats
