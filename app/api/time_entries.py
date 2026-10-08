import uuid
from datetime import date
from fastapi import APIRouter, Depends, status, Path
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.time_entry import (
    TimeEntryStart,
    TimeEntryStop,
    TimeEntryCreateManual,
    TimeEntryUpdate,
    TimeEntryResponse,
    DailyTimeSummary
)
from app.services.time_tracking import (
    get_user_today,
    start_timer,
    stop_timer,
    create_manual_entry,
    get_entries_for_date,
    update_entry,
    delete_entry,
    get_active_entry
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/time", tags=["Time Tracking"])


@router.get("/today", response_model=DailyTimeSummary, summary="Get today's time entries & active timer")
def get_today_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns today's time summary in the user's configured timezone.
    Includes all completed entries for today, the active timer (if any), and total tracked duration.
    """
    today_date = get_user_today(current_user.timezone)
    return get_entries_for_date(db, current_user, today_date)


@router.get("/active", response_model=TimeEntryResponse | None, summary="Get currently active timer")
def get_current_active_timer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the user's currently running active timer, or null if no timer is active.
    """
    entry = get_active_entry(db, current_user.id)
    if not entry:
        return None
    return TimeEntryResponse.from_orm_entry(entry)


@router.get("/date/{entry_date}", response_model=DailyTimeSummary, summary="Get time entries for a specific date")
def get_date_summary(
    entry_date: date = Path(description="Target date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the time summary and completed entries for any given date in the user's timezone.
    """
    return get_entries_for_date(db, current_user, entry_date)


@router.post("/start", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED, summary="Start live timer")
def start_live_timer(
    data: TimeEntryStart,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Starts an active live timer for the current user.
    Rejects the request if an active timer is already running (at most 1 active timer per user).
    """
    entry = start_timer(db, current_user, data.note)
    return TimeEntryResponse.from_orm_entry(entry)


@router.post("/stop", response_model=TimeEntryResponse, summary="Stop active timer")
def stop_live_timer(
    data: TimeEntryStop,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stops the user's currently running timer and saves the completed entry.
    """
    entry = stop_timer(db, current_user, data.note)
    return TimeEntryResponse.from_orm_entry(entry)


@router.post("/manual", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED, summary="Add manual historical entry")
def add_manual_entry(
    data: TimeEntryCreateManual,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually creates a completed historical entry for past dates or earlier today.
    Enforces end_time > start_time and strictly forbids future time entries.
    """
    entry = create_manual_entry(db, current_user, data)
    return TimeEntryResponse.from_orm_entry(entry)


@router.patch("/{entry_id}", response_model=TimeEntryResponse, summary="Edit a time entry")
def edit_time_entry(
    entry_id: uuid.UUID,
    data: TimeEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Edits start time, end time, or note of an existing time entry.
    Enforces user data isolation and forbids future timestamps.
    """
    entry = update_entry(db, current_user, entry_id, data)
    return TimeEntryResponse.from_orm_entry(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_200_OK, summary="Delete a time entry")
def delete_time_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a time entry owned by the authenticated user.
    """
    delete_entry(db, current_user, entry_id)
    return {"message": "Time entry deleted successfully."}
