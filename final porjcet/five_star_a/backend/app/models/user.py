from __future__ import annotations

import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, JSON, String, Text, Uuid, func
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    project_manager = "project_manager"
    employee = "employee"


class OAuthProvider(str, enum.Enum):
    google = "google"
    github = "github"
    microsoft = "microsoft"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role"), default=UserRole.employee, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_factor_secret: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="users")
    created_projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="creator", foreign_keys="Project.created_by"
    )
    assigned_tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="assignee", foreign_keys="Task.assigned_to"
    )
    created_tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="creator", foreign_keys="Task.created_by"
    )
    devices: Mapped[list["Device"]] = relationship(
        "Device", back_populates="user", cascade="all, delete-orphan"
    )
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        "OAuthAccount", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    integrations: Mapped[list["Integration"]] = relationship(
        "Integration", back_populates="user", cascade="all, delete-orphan"
    )
    widget_states: Mapped[list["WidgetState"]] = relationship(
        "WidgetState", back_populates="user", cascade="all, delete-orphan"
    )
    pomodoro_sessions: Mapped[list["PomodoroSession"]] = relationship(
        "PomodoroSession", back_populates="user", cascade="all, delete-orphan"
    )
    daily_goals: Mapped[list["DailyGoal"]] = relationship(
        "DailyGoal", back_populates="user", cascade="all, delete-orphan"
    )
    analytics: Mapped[list["UserAnalytics"]] = relationship(
        "UserAnalytics", back_populates="user", cascade="all, delete-orphan"
    )
    comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment", back_populates="author", cascade="all, delete-orphan"
    )
    friend_requests_sent: Mapped[list["FriendConnection"]] = relationship(
        "FriendConnection", foreign_keys="FriendConnection.user_id", back_populates="user"
    )
    friend_requests_received: Mapped[list["FriendConnection"]] = relationship(
        "FriendConnection", foreign_keys="FriendConnection.friend_id", back_populates="friend"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    chat_messages: Mapped[list["TeamChatMessage"]] = relationship(
        "TeamChatMessage", back_populates="user", cascade="all, delete-orphan"
    )
    uploaded_attachments: Mapped[list["TaskAttachment"]] = relationship(
        "TaskAttachment", back_populates="uploader", foreign_keys="TaskAttachment.uploaded_by"
    )

    def __repr__(self) -> str:
        return f"User(id={self.id}, email={self.email}, username={self.username})"


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    provider: Mapped[OAuthProvider] = mapped_column(
        SQLEnum(OAuthProvider, name="oauth_provider"), nullable=False
    )
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")

    def __repr__(self) -> str:
        return f"OAuthAccount(id={self.id}, provider={self.provider}, user_id={self.user_id})"
