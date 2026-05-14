"""Integration models for external services."""

from __future__ import annotations

import enum
import uuid
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
    Uuid,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IntegrationProvider(str, enum.Enum):
    spotify = "spotify"


class WidgetType(str, enum.Enum):
    weather = "weather"
    spotify = "spotify"
    pomodoro = "pomodoro"
    goals = "goals"
    insights = "insights"
    friends = "friends"


class FriendStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    blocked = "blocked"


class Integration(Base):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider: Mapped[IntegrationProvider] = mapped_column(
        SQLEnum(IntegrationProvider, name="integration_provider"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    last_sync: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="integrations")

    def __repr__(self) -> str:
        return f"Integration(id={self.id}, provider={self.provider})"


class WidgetState(Base):
    __tablename__ = "widget_states"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    widget_type: Mapped[WidgetType] = mapped_column(SQLEnum(WidgetType, name="widget_type"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    position: Mapped[int] = mapped_column(default=0, nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="widget_states")


class PomodoroSession(Base):
    __tablename__ = "pomodoro_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("tasks.id"), nullable=True)
    duration: Mapped[int] = mapped_column(nullable=False)
    break_duration: Mapped[int] = mapped_column(nullable=False)
    completed_cycles: Mapped[int] = mapped_column(default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    started_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="pomodoro_sessions")
    task: Mapped["Task"] = relationship("Task")


class DailyGoal(Base):
    __tablename__ = "daily_goals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    goal_text: Mapped[str] = mapped_column(String(500), nullable=False)
    target_date: Mapped[Date] = mapped_column(Date, index=True, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="daily_goals")


class UserAnalytics(Base):
    __tablename__ = "user_analytics"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_analytics_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date: Mapped[Date] = mapped_column(Date, index=True, nullable=False)
    tasks_created: Mapped[int] = mapped_column(default=0, nullable=False)
    tasks_completed: Mapped[int] = mapped_column(default=0, nullable=False)
    tasks_overdue: Mapped[int] = mapped_column(default=0, nullable=False)
    pomodoro_sessions: Mapped[int] = mapped_column(default=0, nullable=False)
    active_minutes: Mapped[int] = mapped_column(default=0, nullable=False)
    productivity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="analytics")


class FriendConnection(Base):
    __tablename__ = "friend_connections"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friend_connection"),
        CheckConstraint("user_id <> friend_id", name="ck_user_not_friend_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    friend_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[FriendStatus] = mapped_column(
        SQLEnum(FriendStatus, name="friend_status"), default=FriendStatus.pending, nullable=False
    )
    requested_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="friend_requests_sent"
    )
    friend: Mapped["User"] = relationship(
        "User", foreign_keys=[friend_id], back_populates="friend_requests_received"
    )

    def __repr__(self) -> str:
        return f"FriendConnection(user_id={self.user_id}, friend_id={self.friend_id}, status={self.status})"
