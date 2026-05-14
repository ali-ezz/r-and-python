from __future__ import annotations

from typing import Optional
from datetime import date, datetime
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.integration import DailyGoal, PomodoroSession


async def fetch_weather(latitude: float, longitude: float) -> dict:
    if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid latitude or longitude")

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Weather provider unavailable")

    payload = response.json()
    current = payload.get("current") or {}

    return {
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "timezone": payload.get("timezone"),
        "elevation": payload.get("elevation"),
        "current": {
            "temperature": current.get("temperature_2m"),
            "apparent_temperature": current.get("apparent_temperature"),
            "humidity": current.get("relative_humidity_2m"),
            "weather_code": current.get("weather_code"),
            "wind_speed": current.get("wind_speed_10m"),
            "time": current.get("time"),
        },
    }


def list_goals(db: Session, user_id: UUID, include_completed: bool = True, target_date: Optional[date] = None) -> list[DailyGoal]:
    query = db.query(DailyGoal).filter(DailyGoal.user_id == user_id)

    if not include_completed:
        query = query.filter(DailyGoal.is_completed.is_(False))

    if target_date is not None:
        query = query.filter(DailyGoal.target_date == target_date)

    return query.order_by(DailyGoal.target_date.asc(), DailyGoal.created_at.asc()).all()


def create_goal(db: Session, user_id: UUID, goal_text: str, target_date: date) -> DailyGoal:
    if not goal_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Goal text cannot be empty")

    goal = DailyGoal(user_id=user_id, goal_text=goal_text.strip(), target_date=target_date)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def complete_goal(db: Session, user_id: UUID, goal_id: UUID) -> DailyGoal:
    goal = db.query(DailyGoal).filter(DailyGoal.id == goal_id, DailyGoal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    goal.is_completed = True
    goal.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(goal)
    return goal


def get_active_pomodoro(db: Session, user_id: UUID) -> Optional[PomodoroSession]:
    return (
        db.query(PomodoroSession)
        .filter(PomodoroSession.user_id == user_id, PomodoroSession.is_active.is_(True))
        .order_by(PomodoroSession.created_at.desc())
        .first()
    )


def list_pomodoro_sessions(db: Session, user_id: UUID, limit: int = 20) -> list[PomodoroSession]:
    return (
        db.query(PomodoroSession)
        .filter(PomodoroSession.user_id == user_id)
        .order_by(PomodoroSession.created_at.desc())
        .limit(limit)
        .all()
    )


def start_pomodoro(
    db: Session,
    user_id: UUID,
    duration: int,
    break_duration: int,
    task_id: Optional[UUID] = None,
) -> PomodoroSession:
    if duration <= 0 or break_duration < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pomodoro duration settings")

    active = get_active_pomodoro(db, user_id)
    if active is not None:
        active.is_active = False

    session = PomodoroSession(
        user_id=user_id,
        task_id=task_id,
        duration=duration,
        break_duration=break_duration,
        completed_cycles=0,
        is_active=True,
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def complete_pomodoro(db: Session, user_id: UUID, session_id: UUID, completed_cycles: int) -> PomodoroSession:
    session = (
        db.query(PomodoroSession)
        .filter(PomodoroSession.id == session_id, PomodoroSession.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pomodoro session not found")

    session.is_active = False
    session.completed_cycles = max(completed_cycles, 0)
    session.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session