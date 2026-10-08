import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Uuid, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimeEntry(Base):
    """
    SQLAlchemy ORM model representing actual tracked time sessions ('time_entries' table).
    
    Fields:
      id: UUID primary key
      user_id: Foreign key to users.id
      start_time: Timezone-aware UTC timestamp when session started
      end_time: Timezone-aware UTC timestamp when session ended (NULL if timer is currently running)
      note: Optional description of the work performed
      created_at / updated_at: Timestamps for auditing
    """
    __tablename__ = "time_entries"

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
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
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

    # Relationship back to User
    user = relationship("User", backref="time_entries")

    __table_args__ = (
        # Index on (user_id, start_time) as required by GEMINI.md Section 8
        Index("ix_time_entries_user_start", "user_id", "start_time"),

        # Partial Unique Index: enforces at most ONE active timer (where end_time IS NULL) per user
        Index(
            "ix_one_active_timer_per_user",
            "user_id",
            unique=True,
            postgresql_where=(end_time.is_(None)),
            sqlite_where=(end_time.is_(None)),
        ),

        # Database Check Constraint: end_time must be after start_time for completed entries
        CheckConstraint(
            "end_time IS NULL OR end_time > start_time",
            name="check_end_after_start"
        ),
    )

    def __repr__(self) -> str:
        return f"<TimeEntry id={self.id} user_id={self.user_id} start={self.start_time} end={self.end_time}>"
