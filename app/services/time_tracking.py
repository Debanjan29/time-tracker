import uuid
import zoneinfo
from datetime import datetime, date, time, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.user import User
from app.models.time_entry import TimeEntry
from app.schemas.time_entry import (
    TimeEntryCreateManual,
    TimeEntryUpdate,
    TimeEntryResponse,
    DailyTimeSummary,
    format_seconds_to_human
)


def get_user_zone(timezone_name: str) -> zoneinfo.ZoneInfo:
    """Safely retrieves a ZoneInfo instance for a timezone string, falling back to UTC."""
    try:
        return zoneinfo.ZoneInfo(timezone_name)
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def get_user_today(timezone_name: str) -> date:
    """
    Returns today's date according to the user's configured timezone.
    Follows GEMINI.md Section 9: Server timezone must NEVER dictate user's current date.
    """
    user_tz = get_user_zone(timezone_name)
    return datetime.now(user_tz).date()


def get_date_utc_range(target_date: date, timezone_name: str) -> tuple[datetime, datetime]:
    """
    Computes the UTC start and end bounds for a specific calendar date in the user's timezone.
    Covers midnight to midnight (next day 00:00:00).
    """
    user_tz = get_user_zone(timezone_name)
    local_start = datetime.combine(target_date, time.min).replace(tzinfo=user_tz)
    local_end = local_start + timedelta(days=1)
    
    # Convert local bounds to UTC timestamps for database querying
    utc_start = local_start.astimezone(timezone.utc)
    utc_end = local_end.astimezone(timezone.utc)
    return utc_start, utc_end


def get_active_entry(db: Session, user_id: uuid.UUID) -> TimeEntry | None:
    """
    Retrieves the currently running TimeEntry (where end_time is NULL) for a user.
    """
    statement = select(TimeEntry).where(
        and_(
            TimeEntry.user_id == user_id,
            TimeEntry.end_time.is_(None)
        )
    )
    return db.scalars(statement).first()


def start_timer(db: Session, user: User, note: str | None = None) -> TimeEntry:
    """
    Starts an active live timer for the user.
    Enforces Rule 3: Only ONE active timer per user.
    """
    existing_active = get_active_entry(db, user.id)
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active timer running. Stop it before starting a new one."
        )

    now_utc = datetime.now(timezone.utc)
    entry = TimeEntry(
        user_id=user.id,
        start_time=now_utc,
        end_time=None,
        note=note.strip() if note else None
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def stop_timer(db: Session, user: User, note: str | None = None) -> TimeEntry:
    """
    Stops the currently running active timer.
    Enforces Rule 7: end_time > start_time.
    """
    entry = get_active_entry(db, user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active timer is currently running."
        )

    now_utc = datetime.now(timezone.utc)
    
    # Guarantee end_time > start_time even if stopped immediately after starting
    start_time = entry.start_time if entry.start_time.tzinfo else entry.start_time.replace(tzinfo=timezone.utc)
    if now_utc <= start_time:
        now_utc = start_time + timedelta(seconds=1)

    entry.end_time = now_utc
    if note is not None:
        entry.note = note.strip() if note.strip() else None

    db.commit()
    db.refresh(entry)
    return entry


def create_manual_entry(db: Session, user: User, data: TimeEntryCreateManual) -> TimeEntry:
    """
    Creates a completed time entry for past dates or earlier today.
    """
    # Ensure UTC timezone
    start = data.start_time if data.start_time.tzinfo else data.start_time.replace(tzinfo=timezone.utc)
    end = data.end_time if data.end_time.tzinfo else data.end_time.replace(tzinfo=timezone.utc)

    start_utc = start.astimezone(timezone.utc)
    end_utc = end.astimezone(timezone.utc)

    entry = TimeEntry(
        user_id=user.id,
        start_time=start_utc,
        end_time=end_utc,
        note=data.note.strip() if data.note else None
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_entries_for_date(db: Session, user: User, target_date: date) -> DailyTimeSummary:
    """
    Retrieves all time entries and calculated daily total for a given date in the user's timezone.
    Includes active timer duration if looking at today!
    """
    utc_start, utc_end = get_date_utc_range(target_date, user.timezone)
    user_today = get_user_today(user.timezone)

    # Completed entries for this date
    statement = (
        select(TimeEntry)
        .where(
            and_(
                TimeEntry.user_id == user.id,
                TimeEntry.start_time >= utc_start,
                TimeEntry.start_time < utc_end,
                TimeEntry.end_time.is_not(None)
            )
        )
        .order_by(TimeEntry.start_time.asc())
    )
    completed_entries = list(db.scalars(statement).all())

    # Active entry check (relevant if viewing today)
    active_entry = None
    if target_date == user_today:
        active_entry = get_active_entry(db, user.id)

    # Transform to schemas with derived durations
    response_entries = [TimeEntryResponse.from_orm_entry(e) for e in completed_entries]
    active_response = TimeEntryResponse.from_orm_entry(active_entry) if active_entry else None

    # Calculate total duration for this day
    total_seconds = sum(e.duration_seconds for e in response_entries)
    if active_response:
        total_seconds += active_response.duration_seconds

    return DailyTimeSummary(
        date=target_date.isoformat(),
        total_duration_seconds=total_seconds,
        total_duration_formatted=format_seconds_to_human(total_seconds),
        active_entry=active_response,
        entries=response_entries
    )


def update_entry(db: Session, user: User, entry_id: uuid.UUID, data: TimeEntryUpdate) -> TimeEntry:
    """
    Updates an existing TimeEntry.
    Enforces user isolation, valid bounds, and future entry restrictions.
    """
    statement = select(TimeEntry).where(
        and_(
            TimeEntry.id == entry_id,
            TimeEntry.user_id == user.id
        )
    )
    entry = db.scalars(statement).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found."
        )

    now_utc = datetime.now(timezone.utc)
    new_start = entry.start_time if entry.start_time.tzinfo else entry.start_time.replace(tzinfo=timezone.utc)
    new_end = entry.end_time
    if new_end is not None and new_end.tzinfo is None:
        new_end = new_end.replace(tzinfo=timezone.utc)

    if data.start_time is not None:
        st = data.start_time if data.start_time.tzinfo else data.start_time.replace(tzinfo=timezone.utc)
        new_start = st.astimezone(timezone.utc)
        if new_start > now_utc + timedelta(seconds=60):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_time cannot be in the future."
            )

    if data.end_time is not None:
        et = data.end_time if data.end_time.tzinfo else data.end_time.replace(tzinfo=timezone.utc)
        new_end = et.astimezone(timezone.utc)
        if new_end > now_utc + timedelta(seconds=60):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end_time cannot be in the future."
            )

    if new_end is not None and new_end <= new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be strictly after start_time."
        )

    entry.start_time = new_start
    entry.end_time = new_end
    if data.note is not None:
        entry.note = data.note.strip() if data.note.strip() else None

    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(db: Session, user: User, entry_id: uuid.UUID) -> None:
    """
    Deletes a TimeEntry, verifying ownership.
    """
    statement = select(TimeEntry).where(
        and_(
            TimeEntry.id == entry_id,
            TimeEntry.user_id == user.id
        )
    )
    entry = db.scalars(statement).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found."
        )

    db.delete(entry)
    db.commit()
