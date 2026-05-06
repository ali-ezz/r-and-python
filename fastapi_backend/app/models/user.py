"""User model with role-based access control."""

from sqlalchemy import Column, String, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from app.db.database import Base
from app.models.base import BaseModelMixin


class RoleEnum(str, enum.Enum):
    """Roles available in the system."""
    ADMIN = "ADMIN"
    INSTRUCTOR = "INSTRUCTOR"
    STUDENT = "STUDENT"


class User(BaseModelMixin, Base):
    """SQLAlchemy User model with full profile fields."""
    __tablename__ = "users"

    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True, default="")
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    student_profile = relationship(
        "Student", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
