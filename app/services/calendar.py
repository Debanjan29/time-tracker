import calendar
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.user import User
from app.models.time_entry import TimeEntry
from app.models.calendar_note import CalendarNote
from app.schemas.calendar import DaySummary, MonthCalendarResponse
from app.schemas.time_entry import format_seconds_to_human
from app.services.time_tracking import get_user_zone, get_user_today, get_active_entry


def get_month_calendar(
    db: Session,
    user: User,
    year: int,
    month: int
) -> MonthCalendarResponse:
    """
    Returns the monthly calendar with day-by-day aggregates for tracked time and planning notes.
    Efficiently queries the month in two queries and groups in the user's timezone.
    """
    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12."
        )

    user_tz = get_user_zone(user.timezone)
    user_today = get_user_today(user.timezone)
    first_weekday, num_days = calendar.monthrange(year, month)
    month_name = calendar.month_name[month]

    # Calculate month boundary in user's timezone converted to UTC
    month_start_local = datetime(year, month, 1, 0, 0, 0, tzinfo=user_tz)
    month_end_local = datetime(year, month, num_days, 0, 0, 0, tzinfo=user_tz) + timedelta(days=1)
    
    month_start_utc = month_start_local.astimezone(timezone.utc)
    month_end_utc = month_end_local.astimezone(timezone.utc)

    # 1. Fetch all completed entries for this user in this month range
    entries_stmt = select(TimeEntry).where(
        and_(
            TimeEntry.user_id == user.id,
            TimeEntry.start_time >= month_start_utc,
            TimeEntry.start_time < month_end_utc,
            TimeEntry.end_time.is_not(None)
        )
    )
    entries = list(db.scalars(entries_stmt).all())

    # 2. Fetch all planning notes for this user in this month
    notes_stmt = select(CalendarNote).where(
        and_(
            CalendarNote.user_id == user.id,
            CalendarNote.date >= date(year, month, 1),
            CalendarNote.date <= date(year, month, num_days)
        )
    )
    notes = list(db.scalars(notes_stmt).all())

    # Map daily durations and entry flags
    day_duration_map: dict[date, int] = {}
    day_has_entries_map: dict[date, bool] = {}
    for entry in entries:
        # Convert start_time to user's timezone to determine calendar date
        st = entry.start_time if entry.start_time.tzinfo else entry.start_time.replace(tzinfo=timezone.utc)
        et = entry.end_time if entry.end_time.tzinfo else entry.end_time.replace(tzinfo=timezone.utc)
        entry_date = st.astimezone(user_tz).date()

        duration = int((et - st).total_seconds())
        day_duration_map[entry_date] = day_duration_map.get(entry_date, 0) + max(0, duration)
        day_has_entries_map[entry_date] = True

    # Check for active timer if viewing current month and today is in it
    active_entry = get_active_entry(db, user.id)
    if active_entry and user_today.year == year and user_today.month == month:
        now_utc = datetime.now(timezone.utc)
        act_st = active_entry.start_time if active_entry.start_time.tzinfo else active_entry.start_time.replace(tzinfo=timezone.utc)
        active_secs = int((now_utc - act_st).total_seconds())
        day_duration_map[user_today] = day_duration_map.get(user_today, 0) + max(0, active_secs)
        day_has_entries_map[user_today] = True

    # Map notes presence
    day_has_notes_map: dict[date, bool] = {}
    for note in notes:
        day_has_notes_map[note.date] = True

    # Assemble days list
    days: list[DaySummary] = []
    weekday_abbrs = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for d in range(1, num_days + 1):
        cur_date = date(year, month, d)
        duration_sec = day_duration_map.get(cur_date, 0)
        has_ent = day_has_entries_map.get(cur_date, False)
        has_not = day_has_notes_map.get(cur_date, False)
        is_today = (cur_date == user_today)
        is_future = (cur_date > user_today)
        weekday_idx = cur_date.weekday()

        days.append(
            DaySummary(
                date=cur_date.isoformat(),
                day_number=d,
                day_name=weekday_abbrs[weekday_idx],
                total_duration_seconds=duration_sec,
                total_duration_formatted=format_seconds_to_human(duration_sec),
                has_entries=has_ent,
                has_notes=has_not,
                is_today=is_today,
                is_future=is_future
            )
        )

    return MonthCalendarResponse(
        year=year,
        month=month,
        month_name=month_name,
        days_in_month=num_days,
        first_weekday=first_weekday,
        days=days
    )
