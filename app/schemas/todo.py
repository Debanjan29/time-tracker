import uuid
import datetime as dt
from pydantic import BaseModel, Field, ConfigDict


class TodoCreate(BaseModel):
    """Payload to create a new task/to-do."""
    text: str = Field(min_length=1, max_length=500, description="Task description")
    start_date: dt.date = Field(description="Calendar date in YYYY-MM-DD format")
    is_daily: bool = Field(default=False, description="Whether this task repeats daily until disabled")
    reminder_time: dt.time | None = Field(default=None, description="Optional reminder time (HH:MM or HH:MM:SS)")


class TodoUpdate(BaseModel):
    """Payload to edit task text or settings."""
    text: str | None = Field(default=None, min_length=1, max_length=500, description="Updated task text")
    is_daily: bool | None = Field(default=None, description="Toggle daily recurrence")
    is_disabled: bool | None = Field(default=None, description="Whether recurrence is disabled")
    reminder_time: dt.time | None = Field(default=None, description="Updated reminder time")
    clear_reminder: bool = Field(default=False, description="Set True to remove existing reminder time")


class TodoDisableRequest(BaseModel):
    """Payload when disabling recurrence from a specific date."""
    disabled_date: dt.date | None = Field(
        default=None,
        description="Date starting from which recurrence is disabled. Defaults to selected date if None."
    )


class TodoResponse(BaseModel):
    """Safe public representation of a Todo for a specific day."""
    id: uuid.UUID
    user_id: uuid.UUID
    text: str
    start_date: dt.date
    is_daily: bool
    is_disabled: bool
    disabled_date: dt.date | None = None
    reminder_time: dt.time | None = None
    completed: bool = False
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = ConfigDict(from_attributes=True)


class TodoToggleRequest(BaseModel):
    """Optional payload to explicitly set completed state instead of auto-toggle."""
    completed: bool | None = None


class TodoToggleResponse(BaseModel):
    """Response returned when toggling todo completion."""
    todo_id: uuid.UUID
    date: dt.date
    completed: bool
    message: str
