import uuid
import datetime as dt
from pydantic import BaseModel, Field, ConfigDict


class CalendarNoteCreate(BaseModel):
    """Payload to create a new planning note for a specific date."""
    date: dt.date = Field(description="Calendar date in YYYY-MM-DD format")
    note: str = Field(min_length=1, max_length=2000, description="Planning note text")


class CalendarNoteUpdate(BaseModel):
    """Payload to edit an existing planning note."""
    note: str = Field(min_length=1, max_length=2000, description="Updated planning note text")


class CalendarNoteResponse(BaseModel):
    """Safe public representation of a CalendarNote."""
    id: uuid.UUID
    user_id: uuid.UUID
    date: dt.date
    note: str
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = ConfigDict(from_attributes=True)
