"""User analytics and productivity scoring service."""

from __future__ import annotations

from typing import Optional
import math
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.integration import (
    DailyGoal,
    PomodoroSession,
    UserAnalytics,
)
from app.models.task import Task, TaskStatus


def get_weekly_summary(
    db: Session,
    user_id: UUID,
) -> dict:
    """Get a weekly productivity summary for the user."""
    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    analytics = (
        db.query(UserAnalytics)
        .filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.date >= week_start,
            UserAnalytics.date <= week_end,
        )
        .order_by(UserAnalytics.date.asc())
        .all()
    )

    total_tasks_created = sum(a.tasks_created for a in analytics)
    total_tasks_completed = sum(a.tasks_completed for a in analytics)
    total_pomodoro = sum(a.pomodoro_sessions for a in analytics)
    total_active_minutes = sum(a.active_minutes for a in analytics)
    avg_productivity = (
        sum(a.productivity_score for a in analytics) / len(analytics) if analytics else 0.0
    )

    # Count overdue tasks (due before today and not completed)
    overdue_tasks = (
        db.query(func.count(Task.id))
        .filter(
            Task.created_by == user_id,
            Task.due_date < datetime.utcnow(),
            Task.status != TaskStatus.done,
        )
        .scalar() or 0
    )

    return {
        "period": "week",
        "start_date": week_start.isoformat(),
        "end_date": week_end.isoformat(),
        "tasks_created": total_tasks_created,
        "tasks_completed": total_tasks_completed,
        "completion_rate": round(total_tasks_completed / total_tasks_created, 4) if total_tasks_created else 0.0,
        "pomodoro_sessions": total_pomodoro,
        "active_minutes": total_active_minutes,
        "avg_productivity_score": round(avg_productivity, 2),
        "overdue_tasks": overdue_tasks,
        "daily_breakdown": [
            {
                "date": a.date.isoformat(),
                "tasks_created": a.tasks_created,
                "tasks_completed": a.tasks_completed,
                "productivity_score": a.productivity_score,
            }
            for a in analytics
        ],
    }


def get_streak_info(
    db: Session,
    user_id: UUID,
) -> dict:
    """Calculate current and longest task completion streaks."""
    analytics = (
        db.query(UserAnalytics)
        .filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.tasks_completed > 0,
        )
        .order_by(UserAnalytics.date.desc())
        .all()
    )

    if not analytics:
        return {"current_streak": 0, "longest_streak": 0, "last_active_date": None}

    today = datetime.utcnow().date()
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    last_date = None

    for entry in analytics:
        if last_date is None:
            if entry.date == today or entry.date == today - timedelta(days=1):
                current_streak = 1
            last_date = entry.date
            temp_streak = 1
            longest_streak = 1
            continue

        expected = last_date - timedelta(days=1)
        if entry.date == expected:
            temp_streak += 1
            if entry.date >= today - timedelta(days=current_streak):
                current_streak = temp_streak
        else:
            temp_streak = 1

        longest_streak = max(longest_streak, temp_streak)
        last_date = entry.date

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_active_date": last_date.isoformat() if last_date else None,
    }


def calculate_productivity_score(
    db: Session,
    user_id: UUID,
    target_date: Optional[date] = None,
) -> float:
    """Calculate a productivity score (0-100) based on multiple factors."""
    today = target_date or datetime.utcnow().date()

    analytics = (
        db.query(UserAnalytics)
        .filter(UserAnalytics.user_id == user_id, UserAnalytics.date == today)
        .first()
    )

    if not analytics:
        return 0.0

    score = 0.0

    task_score = min(analytics.tasks_completed * 10, 40)
    pomodoro_score = min(analytics.pomodoro_sessions * 5, 25)
    active_score = min(analytics.active_minutes / 10, 20)

    overdue_penalty = max(analytics.tasks_overdue * -5, -25)
    score = task_score + pomodoro_score + active_score + overdue_penalty

    return round(max(0, min(100, score)), 1)


def record_daily_activity(
    db: Session,
    user_id: UUID,
    tasks_created: int = 0,
    tasks_completed: int = 0,
    tasks_overdue: int = 0,
    pomodoro_sessions: int = 0,
    active_minutes: int = 0,
) -> UserAnalytics:
    """Record or update daily activity metrics."""
    today = datetime.utcnow().date()

    analytics = (
        db.query(UserAnalytics)
        .filter(UserAnalytics.user_id == user_id, UserAnalytics.date == today)
        .first()
    )

    if analytics:
        analytics.tasks_created += tasks_created
        analytics.tasks_completed += tasks_completed
        analytics.tasks_overdue = max(analytics.tasks_overdue, tasks_overdue)
        analytics.pomodoro_sessions += pomodoro_sessions
        analytics.active_minutes += active_minutes
    else:
        analytics = UserAnalytics(
            user_id=user_id,
            date=today,
            tasks_created=tasks_created,
            tasks_completed=tasks_completed,
            tasks_overdue=tasks_overdue,
            pomodoro_sessions=pomodoro_sessions,
            active_minutes=active_minutes,
        )
        db.add(analytics)

    analytics.productivity_score = calculate_productivity_score(db, user_id, target_date=today)
    db.commit()
    db.refresh(analytics)
    return analytics


def get_monthly_trend(
    db: Session,
    user_id: UUID,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> list[dict]:
    """Get daily analytics trend for a specific month."""
    now = datetime.utcnow()
    target_year = year or now.year
    target_month = month or now.month

    if target_month == 12:
        next_month = date(target_year + 1, 1, 1)
    else:
        next_month = date(target_year, target_month + 1, 1)

    start_date = date(target_year, target_month, 1)

    analytics = (
        db.query(UserAnalytics)
        .filter(
            UserAnalytics.user_id == user_id,
            UserAnalytics.date >= start_date,
            UserAnalytics.date < next_month,
        )
        .order_by(UserAnalytics.date.asc())
        .all()
    )

    return [
        {
            "date": a.date.isoformat(),
            "tasks_created": a.tasks_created,
            "tasks_completed": a.tasks_completed,
            "pomodoro_sessions": a.pomodoro_sessions,
            "productivity_score": a.productivity_score,
        }
        for a in analytics
    ]


def get_goal_completion_rate(
    db: Session,
    user_id: UUID,
    days: int = 30,
) -> dict:
    """Get goal completion rate over recent days."""
    cutoff = datetime.utcnow().date() - timedelta(days=days)

    goals = (
        db.query(DailyGoal)
        .filter(
            DailyGoal.user_id == user_id,
            DailyGoal.target_date >= cutoff,
        )
        .all()
    )

    total = len(goals)
    completed = sum(1 for g in goals if g.is_completed)

    return {
        "total_goals": total,
        "completed_goals": completed,
        "completion_rate": round(completed / total, 4) if total else 0.0,
        "period_days": days,
    }
