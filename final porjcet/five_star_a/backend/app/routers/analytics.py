"""User analytics and productivity metrics API."""

from __future__ import annotations

from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services import analytics_service
from app.schemas.analytics_focus import (
    WeeklySummaryResponse,
    StreakInfoResponse,
    ProductivityScoreResponse,
    MonthlyTrendEntry,
    GoalCompletionResponse,
)
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/weekly", response_model=WeeklySummaryResponse)
def weekly_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> WeeklySummaryResponse:
    """Get weekly productivity summary."""
    data = analytics_service.get_weekly_summary(db, current_user.id)
    return WeeklySummaryResponse(
        total_tasks=data.get("tasks_created", 0),
        completed_tasks=data.get("tasks_completed", 0),
        overdue_tasks=data.get("overdue_tasks", 0),
        completion_rate=data.get("completion_rate", 0.0),
        week_start=data.get("start_date", ""),
        week_end=data.get("end_date", ""),
    )


@router.get("/streaks", response_model=StreakInfoResponse)
def streak_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StreakInfoResponse:
    """Get current and longest streaks."""
    data = analytics_service.get_streak_info(db, current_user.id)
    return StreakInfoResponse(**data)


@router.get("/productivity-score", response_model=ProductivityScoreResponse)
def productivity_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ProductivityScoreResponse:
    """Get today's productivity score."""
    score = analytics_service.calculate_productivity_score(db, current_user.id)
    return ProductivityScoreResponse(score=score, date=date.today().isoformat())


@router.get("/monthly-trend", response_model=list[MonthlyTrendEntry])
def monthly_trend(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[MonthlyTrendEntry]:
    """Get monthly analytics trend."""
    data = analytics_service.get_monthly_trend(db, current_user.id, year, month)
    return [MonthlyTrendEntry(**entry) for entry in data]


@router.get("/goals-completion", response_model=GoalCompletionResponse)
def goal_completion_rate(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> GoalCompletionResponse:
    """Get goal completion rate."""
    data = analytics_service.get_goal_completion_rate(db, current_user.id, days)
    return GoalCompletionResponse(**data)
