from datetime import date
from pydantic import BaseModel


class DaySummary(BaseModel):
    """
    Lightweight summary for a single date in the monthly calendar view.
    Follows GEMINI.md Section 18: Keep calendar request lightweight.
    """
    date: str  # YYYY-MM-DD
    day_number: int  # 1..31
    day_name: str  # Mon, Tue, etc.
    total_duration_seconds: int
    total_duration_formatted: str
    has_entries: bool
    has_notes: bool
    is_today: bool
    is_future: bool


class MonthCalendarResponse(BaseModel):
    """
    Full month calendar response with daily aggregates for indicators.
    """
    year: int
    month: int
    month_name: str
    days_in_month: int
    first_weekday: int  # 0=Monday, 6=Sunday (Python calendar standard)
    days: list[DaySummary]
