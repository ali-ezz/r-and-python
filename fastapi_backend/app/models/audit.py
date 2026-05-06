from sqlalchemy import Column, String, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.database import Base
from app.models.base import BaseModelMixin

class AuditLog(BaseModelMixin, Base):
    """Audit log for recording creations, updates, and deletions."""
    __tablename__ = "audit_logs"

    action = Column(String, nullable=False, index=True)  # CREATE, UPDATE, DELETE
    entity_type = Column(String, nullable=False, index=True) # e.g., "Student"
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Store previous state and new state as JSON
    previous_state = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    new_state = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
