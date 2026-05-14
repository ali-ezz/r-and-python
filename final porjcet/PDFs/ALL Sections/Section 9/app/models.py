# ── Table Definition ─────────────────────────────────────────
# This class tells SQLAlchemy what the "notes" table looks like.
# Note: This is a table definition, not a business logic class.

from sqlalchemy import Column, Integer, String, Text
from database import Base


class NoteTable(Base):
    __tablename__ = "notes"

    id      = Column(Integer, primary_key=True, index=True)
    title   = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)