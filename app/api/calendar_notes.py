import uuid
from datetime import date
from fastapi import APIRouter, Depends, status, Path
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.calendar_note import CalendarNoteCreate, CalendarNoteUpdate, CalendarNoteResponse
from app.services.calendar_note import (
    get_notes_for_date,
    create_calendar_note,
    update_calendar_note,
    delete_calendar_note
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/calendar-notes", tags=["Calendar Notes"])


@router.get("/date/{note_date}", response_model=list[CalendarNoteResponse], summary="Get notes for a specific date")
def get_notes(
    note_date: date = Path(description="Target date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all planning notes for the given date.
    """
    return get_notes_for_date(db, current_user, note_date)


@router.post("", response_model=CalendarNoteResponse, status_code=status.HTTP_201_CREATED, summary="Create a planning note")
def create_note(
    data: CalendarNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new planning note attached to a date.
    Per GEMINI.md Section 19: Planning notes never contribute to tracked hours.
    """
    return create_calendar_note(db, current_user, data)


@router.patch("/{note_id}", response_model=CalendarNoteResponse, summary="Edit a planning note")
def edit_note(
    note_id: uuid.UUID,
    data: CalendarNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the content of an existing planning note.
    """
    return update_calendar_note(db, current_user, note_id, data)


@router.delete("/{note_id}", status_code=status.HTTP_200_OK, summary="Delete a planning note")
def remove_note(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a planning note owned by the authenticated user.
    """
    delete_calendar_note(db, current_user, note_id)
    return {"message": "Calendar note deleted successfully."}
