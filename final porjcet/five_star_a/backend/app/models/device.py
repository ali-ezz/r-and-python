from __future__ import annotations

import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeviceType(str, enum.Enum):
    web = "web"
    mobile = "mobile"
    desktop = "desktop"
    extension = "extension"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    device_name: Mapped[str] = mapped_column(String(200), nullable=False)
    device_type: Mapped[DeviceType] = mapped_column(
        SQLEnum(DeviceType, name="device_type"), nullable=False
    )
    device_fingerprint: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    last_active: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_trusted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="devices")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="device", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"Device(id={self.id}, user_id={self.user_id}, name={self.device_name})"


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("devices.id"), nullable=True
    )
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
    device: Mapped["Device"] = relationship("Device", back_populates="refresh_tokens")

    def __repr__(self) -> str:
        return f"RefreshToken(id={self.id}, user_id={self.user_id}, revoked={self.revoked})"
