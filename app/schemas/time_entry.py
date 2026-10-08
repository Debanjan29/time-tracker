import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


def format_seconds_to_human(seconds: int) -> str:
    """Helper to convert seconds into 'Xh Ym' or 'Xm Ys' human-readable format."""
    if seconds < 0:
        seconds = 0
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    remaining_secs = seconds % 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    if minutes > 0:
        return f"{minutes}m {remaining_secs}s"
    return f"{remaining_secs}s"


class TimeEntryStart(BaseModel):
    """Payload to start a new live timer."""
    note: str | None = Field(default=None, max_length=500, description="Optional note describing the activity")


class TimeEntryStop(BaseModel):
    """Payload to stop the currently active timer."""
    note: str | None = Field(default=None, max_length=500, description="Optional note to update or add upon stopping")


class TimeEntryCreateManual(BaseModel):
    """
    Payload for creating a completed past time entry manually.
    Enforces that start_time and end_time are valid and strictly NOT in the future.
    """
    start_time: datetime = Field(description="Timezone-aware start timestamp")
    end_time: datetime = Field(description="Timezone-aware end timestamp")
    note: str | None = Field(default=None, max_length=500, description="Optional note")

    @model_validator(mode="after")
    def validate_times(self) -> "TimeEntryCreateManual":
        now_utc = datetime.now(timezone.utc)

        # Convert naive datetimes to UTC if needed
        start = self.start_time if self.start_time.tzinfo else self.start_time.replace(tzinfo=timezone.utc)
        end = self.end_time if self.end_time.tzinfo else self.end_time.replace(tzinfo=timezone.utc)

        # Rule 7: end_time must be after start_time
        if end <= start:
            raise ValueError("end_time must be strictly after start_time.")

        # Rule 6: Future time entries are forbidden
        # Allow a small buffer (e.g. 60 seconds) to account for slight clock differences
        buffer_seconds = 60
        if start.timestamp() > now_utc.timestamp() + buffer_seconds:
            raise ValueError("start_time cannot be in the future.")
        if end.timestamp() > now_utc.timestamp() + buffer_seconds:
            raise ValueError("end_time cannot be in the future.")

        return self


class TimeEntryUpdate(BaseModel):
    """Payload for editing an existing time entry."""
    start_time: datetime | None = None
    end_time: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class TimeEntryResponse(BaseModel):
    """
    Public representation of a TimeEntry.
    Duration is dynamically derived, never stored authoritatively.
    """
    id: uuid.UUID
    user_id: uuid.UUID
    start_time: datetime
    end_time: datetime | None
    note: str | None
    is_active: bool
    duration_seconds: int
    duration_formatted: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_entry(cls, entry) -> "TimeEntryResponse":
        """Factory method to compute derived fields from a TimeEntry ORM model."""
        now_utc = datetime.now(timezone.utc)
        is_active = entry.end_time is None

        start_time = entry.start_time if entry.start_time.tzinfo else entry.start_time.replace(tzinfo=timezone.utc)
        end_time = entry.end_time
        if end_time is not None and end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        if is_active:
            # Active timer: duration = current_time - start_time
            seconds = int((now_utc - start_time).total_seconds())
        else:
            # Completed entry: duration = end_time - start_time
            seconds = int((end_time - start_time).total_seconds())

        if seconds < 0:
            seconds = 0

        return cls(
            id=entry.id,
            user_id=entry.user_id,
            start_time=start_time,
            end_time=end_time,
            note=entry.note,
            is_active=is_active,
            duration_seconds=seconds,
            duration_formatted=format_seconds_to_human(seconds),
            created_at=entry.created_at,
            updated_at=entry.updated_at
        )


class DailyTimeSummary(BaseModel):
    """
    Summary of tracked time for a selected date in the user's timezone.
    """
    date: str
    total_duration_seconds: int
    total_duration_formatted: str
    active_entry: TimeEntryResponse | None
    entries: list[TimeEntryResponse]
