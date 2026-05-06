from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base
from app.models.base import BaseModelMixin

class Student(BaseModelMixin, Base):
    __tablename__ = "students"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    department = Column(String, nullable=False, index=True)
    gpa = Column(Float, default=0.0)
    enrollment_year = Column(String, nullable=False)

    # Relationship back to User
    user = relationship("User", back_populates="student_profile")
