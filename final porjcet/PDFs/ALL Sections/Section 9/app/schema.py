# models.py
# ============================================================
# Pydantic schemas define the SHAPE of the data that:
#   - Comes IN  from the client (request body)
#   - Goes  OUT to  the client (response body)
#
# These are different from the database table in database.py.
# The database table is about STORAGE.
# These schemas are about COMMUNICATION.
# ============================================================

from pydantic import BaseModel
from typing import Optional


class NoteCreate(BaseModel):
    """
    What the client sends when creating a new note.
    Both fields are required.
    """
    title: str
    content: str


class NoteUpdate(BaseModel):
    """
    What the client sends when updating a note.
    Both fields are optional — update only what is needed.
    """
    title:   Optional[str] = None
    content: Optional[str] = None


class NoteResponse(BaseModel):
    """
    What we send back to the client.
    Includes the id assigned by the database.
    """
    id:      int
    title:   str
    content: str

    model_config = {"from_attributes": True}