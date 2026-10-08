import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Text, DateTime, Date, Uuid, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CalendarNote(Base):
    """
    SQLAlchemy ORM model representing future planning notes ('calendar_notes' table).
    
    Fields:
      id: UUID primary key
      user_id: Foreign key to users.id
      date: Calendar date (YYYY-MM-DD) for which the note is planned
      note: Content of the planning note/reminder
      created_at / updated_at: Auditing timestamps
    """
    __tablename__ = "calendar_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    note: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", backref="calendar_notes")

    __table_args__ = (
        # Index on (user_id, date) as specified in GEMINI.md Section 8
        Index("ix_calendar_notes_user_date", "user_id", "date"),
    )

    def __repr__(self) -> str:
        return f"<CalendarNote id={self.id} user_id={self.user_id} date={self.date}>"
