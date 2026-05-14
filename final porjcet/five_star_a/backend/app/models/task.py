from __future__ import annotations

import enum
import uuid
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Enum as SQLEnum, Float, ForeignKey, JSON, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rich_content: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(TaskStatus, name="task_status"), default=TaskStatus.todo, index=True, nullable=False
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SQLEnum(TaskPriority, name="task_priority"),
        default=TaskPriority.medium,
        index=True,
        nullable=False,
    )
    difficulty: Mapped[int] = mapped_column(default=1, nullable=False)
    urgency: Mapped[int] = mapped_column(default=1, nullable=False)
    importance: Mapped[int] = mapped_column(default=1, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id"), index=True, nullable=False
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    due_date: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    start_date: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_duration: Mapped[Optional[int]] = mapped_column(nullable=True)
    actual_duration: Mapped[Optional[int]] = mapped_column(nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    voice_note_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    parent_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tasks.id"), nullable=True
    )
    order_index: Mapped[int] = mapped_column(default=0, nullable=False)
    recurrence_rule: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    assignee: Mapped["User"] = relationship(
        "User", back_populates="assigned_tasks", foreign_keys=[assigned_to]
    )
    creator: Mapped["User"] = relationship(
        "User", back_populates="created_tasks", foreign_keys=[created_by]
    )
    subtasks: Mapped[list["Task"]] = relationship("Task", back_populates="parent_task")
    parent_task: Mapped["Task"] = relationship(
        "Task", remote_side=[id], back_populates="subtasks"
    )
    attachments: Mapped[list["TaskAttachment"]] = relationship(
        "TaskAttachment", back_populates="task", cascade="all, delete-orphan"
    )
    comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment", back_populates="task", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="task")

    def __repr__(self) -> str:
        return f"Task(id={self.id}, title={self.title}, status={self.status})"


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped["Task"] = relationship("Task", back_populates="attachments")
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self) -> str:
        return f"TaskAttachment(id={self.id}, file_name={self.file_name})"


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    task: Mapped["Task"] = relationship("Task", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")

    def __repr__(self) -> str:
        return f"TaskComment(id={self.id}, task_id={self.task_id})"
