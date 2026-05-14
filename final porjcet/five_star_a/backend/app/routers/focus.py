from __future__ import annotations

from typing import Optional
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services import focus_service
from app.schemas.analytics_focus import (
    DailyGoalResponse,
    DailyGoalListResponse,
    PomodoroSessionResponse,
    PomodoroActiveResponse,
    PomodoroHistoryResponse,
)
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/focus", tags=["focus"])


class DailyGoalCreateRequest(BaseModel):
    goal_text: str = Field(min_length=1, max_length=500)
    target_date: date


class PomodoroStartRequest(BaseModel):
    duration: int = Field(default=25, ge=1, le=180)
    break_duration: int = Field(default=5, ge=0, le=60)
    task_id: Optional[UUID] = None


class PomodoroCompleteRequest(BaseModel):
    completed_cycles: int = Field(default=1, ge=0, le=100)


def _goal_to_response(goal) -> DailyGoalResponse:
    return DailyGoalResponse(
        id=goal.id,
        goal_text=goal.goal_text,
        target_date=goal.target_date,
        is_completed=goal.is_completed,
        completed_at=goal.completed_at,
        created_at=goal.created_at,
    )


def _pomodoro_to_response(session) -> PomodoroSessionResponse:
    return PomodoroSessionResponse(
        id=session.id,
        task_id=str(session.task_id) if session.task_id else None,
        duration=session.duration,
        break_duration=session.break_duration,
        completed_cycles=session.completed_cycles,
        is_active=session.is_active,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )


@router.get("/weather", response_model=dict)
async def get_weather(
    latitude: float = Query(...),
    longitude: float = Query(...),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    _ = current_user
    return await focus_service.fetch_weather(latitude, longitude)


@router.get("/goals", response_model=DailyGoalListResponse)
def get_goals(
    include_completed: bool = Query(True),
    target_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DailyGoalListResponse:
    goals = focus_service.list_goals(
        db,
        current_user.id,
        include_completed=include_completed,
        target_date=target_date,
    )
    return DailyGoalListResponse(goals=[_goal_to_response(g) for g in goals])


@router.post("/goals", response_model=DailyGoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: DailyGoalCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DailyGoalResponse:
    goal = focus_service.create_goal(db, current_user.id, payload.goal_text, payload.target_date)
    return _goal_to_response(goal)


@router.patch("/goals/{goal_id}/complete", response_model=DailyGoalResponse)
def complete_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DailyGoalResponse:
    goal = focus_service.complete_goal(db, current_user.id, goal_id)
    return _goal_to_response(goal)


@router.get("/pomodoro/active", response_model=PomodoroActiveResponse)
def get_active_pomodoro(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PomodoroActiveResponse:
    session = focus_service.get_active_pomodoro(db, current_user.id)
    if session:
        return PomodoroActiveResponse(session=_pomodoro_to_response(session))
    return PomodoroActiveResponse(session=None)


@router.get("/pomodoro/history", response_model=PomodoroHistoryResponse)
def get_pomodoro_history(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PomodoroHistoryResponse:
    sessions = focus_service.list_pomodoro_sessions(db, current_user.id, limit=limit)
    return PomodoroHistoryResponse(sessions=[_pomodoro_to_response(s) for s in sessions])


@router.post("/pomodoro/start", response_model=PomodoroSessionResponse, status_code=status.HTTP_201_CREATED)
def start_pomodoro(
    payload: PomodoroStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PomodoroSessionResponse:
    session = focus_service.start_pomodoro(
        db,
        current_user.id,
        duration=payload.duration,
        break_duration=payload.break_duration,
        task_id=payload.task_id,
    )
    return _pomodoro_to_response(session)


@router.post("/pomodoro/{session_id}/complete", response_model=PomodoroSessionResponse)
def complete_pomodoro(
    session_id: UUID,
    payload: PomodoroCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PomodoroSessionResponse:
    session = focus_service.complete_pomodoro(
        db,
        current_user.id,
        session_id,
        completed_cycles=payload.completed_cycles,
    )
    return _pomodoro_to_response(session)
