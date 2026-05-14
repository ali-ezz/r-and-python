# routers/notes.py
# ============================================================
# All routes for managing notes (Create, Read, Update, Delete).
#
# Notice the logging pattern in every route:
#   1. Log when the request is received   (what did they ask?)
#   2. Log when the operation succeeds    (what did we do?)
#   3. Log WARNING when something is      (note not found, etc.)
#      expected but missing
#   4. Log ERROR when something breaks    (database error, etc.)
#
# All route functions use regular "def" — no async needed here.
# ============================================================

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import NoteTable
from schema import NoteCreate, NoteUpdate, NoteResponse
import monitoring

logger = logging.getLogger("notes_api.notes")

router = APIRouter(
    prefix="/notes",
    tags=["Notes"]
)


# ── CREATE ───────────────────────────────────────────────────
@router.post("/", response_model=NoteResponse, status_code=201)
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    """Create a new note and save it to the database."""

    logger.info(f"Creating note with title: '{note_data.title}'")

    # Build the new note object
    new_note = NoteTable(
        title   = note_data.title,
        content = note_data.content
    )

    # Save to database
    db.add(new_note)
    db.commit()
    db.refresh(new_note)   # Load the generated ID from database

    # Update metrics
    monitoring.note_was_created()

    logger.info(
        f"Note created successfully | "
        f"ID: {new_note.id} | Title: '{new_note.title}'"
    )

    return new_note


# ── READ ALL ─────────────────────────────────────────────────
@router.get("/", response_model=List[NoteResponse])
def get_all_notes(db: Session = Depends(get_db)):
    """Return all notes from the database."""

    notes = db.query(NoteTable).all()

    logger.info(f"Retrieved all notes | Count: {len(notes)}")

    return notes


# ── READ ONE ─────────────────────────────────────────────────
@router.get("/{note_id}", response_model=NoteResponse)
def get_one_note(note_id: int, db: Session = Depends(get_db)):
    """Return a single note by its ID."""

    logger.info(f"Looking for note with ID: {note_id}")

    note = db.query(NoteTable).filter(NoteTable.id == note_id).first()

    if note is None:
        # WARNING — not an error on our side
        # The client asked for something that does not exist
        logger.warning(f"Note with ID {note_id} was not found in database")
        raise HTTPException(
            status_code = 404,
            detail      = f"Note with ID {note_id} not found"
        )

    logger.info(f"Note found and returned | ID: {note_id}")

    return note


# ── UPDATE ───────────────────────────────────────────────────
@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id:     int,
    update_data: NoteUpdate,
    db:          Session = Depends(get_db)
):
    """Update the title or content of an existing note."""

    logger.info(f"Attempting to update note with ID: {note_id}")

    note = db.query(NoteTable).filter(NoteTable.id == note_id).first()

    if note is None:
        logger.warning(
            f"Update failed — note with ID {note_id} does not exist"
        )
        raise HTTPException(
            status_code = 404,
            detail      = f"Note with ID {note_id} not found"
        )

    # Only update the fields that were actually sent
    # If title is None, the client did not send it, so we keep the old one
    if update_data.title is not None:
        logger.debug(
            f"Updating title of note {note_id}: "
            f"'{note.title}' → '{update_data.title}'"
        )
        note.title = update_data.title

    if update_data.content is not None:
        logger.debug(f"Updating content of note {note_id}")
        note.content = update_data.content

    db.commit()
    db.refresh(note)

    monitoring.note_was_updated()

    logger.info(f"Note updated successfully | ID: {note_id}")

    return note


# ── DELETE ───────────────────────────────────────────────────
@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    """Delete a note permanently from the database."""

    logger.info(f"Attempting to delete note with ID: {note_id}")

    note = db.query(NoteTable).filter(NoteTable.id == note_id).first()

    if note is None:
        logger.warning(
            f"Delete failed — note with ID {note_id} does not exist"
        )
        raise HTTPException(
            status_code = 404,
            detail      = f"Note with ID {note_id} not found"
        )

    # Save the title before deleting so we can include it in the log
    deleted_title = note.title

    db.delete(note)
    db.commit()

    monitoring.note_was_deleted()

    # Deletion is permanent — use INFO so it is always recorded
    logger.info(
        f"Note DELETED from database | "
        f"ID: {note_id} | Title: '{deleted_title}'"
    )

    return {"message": f"Note {note_id} deleted successfully"}