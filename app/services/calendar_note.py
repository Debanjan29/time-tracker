import uuid
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.user import User
from app.models.calendar_note import CalendarNote
from app.schemas.calendar_note import CalendarNoteCreate, CalendarNoteUpdate


def get_notes_for_date(db: Session, user: User, note_date: date) -> list[CalendarNote]:
    """
    Retrieves all planning notes for a given date scoped to the user.
    """
    statement = (
        select(CalendarNote)
        .where(
            and_(
                CalendarNote.user_id == user.id,
                CalendarNote.date == note_date
            )
        )
        .order_by(CalendarNote.created_at.asc())
    )
    return list(db.scalars(statement).all())


def create_calendar_note(db: Session, user: User, data: CalendarNoteCreate) -> CalendarNote:
    """
    Creates a new planning note for a date.
    Per GEMINI.md Section 19: Calendar notes are planning reminders and never count as tracked time.
    """
    note = CalendarNote(
        user_id=user.id,
        date=data.date,
        note=data.note.strip()
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def update_calendar_note(db: Session, user: User, note_id: uuid.UUID, data: CalendarNoteUpdate) -> CalendarNote:
    """
    Updates the content of an existing planning note with ownership verification.
    """
    statement = select(CalendarNote).where(
        and_(
            CalendarNote.id == note_id,
            CalendarNote.user_id == user.id
        )
    )
    note = db.scalars(statement).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar note not found."
        )

    note.note = data.note.strip()
    db.commit()
    db.refresh(note)
    return note


def delete_calendar_note(db: Session, user: User, note_id: uuid.UUID) -> None:
    """
    Deletes a planning note with ownership verification.
    """
    statement = select(CalendarNote).where(
        and_(
            CalendarNote.id == note_id,
            CalendarNote.user_id == user.id
        )
    )
    note = db.scalars(statement).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar note not found."
        )

    db.delete(note)
    db.commit()
