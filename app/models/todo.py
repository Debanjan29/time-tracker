import uuid
from datetime import datetime, date, timezone, time
from sqlalchemy import Text, DateTime, Date, Time, Boolean, Uuid, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Todo(Base):
    """
    SQLAlchemy ORM model representing user tasks/to-dos ('todos' table).
    
    Fields:
      id: UUID primary key
      user_id: Foreign key to users.id
      text: The task description
      start_date: Calendar date (YYYY-MM-DD) when the task begins / was created
      is_daily: If True, this task repeats every day starting from start_date
      is_disabled: If True, recurrence has been turned off
      disabled_date: The date starting from which recurrence was turned off (inclusive or after)
      reminder_time: Optional time of day (HH:MM:SS) for notification chime
      created_at / updated_at: Auditing timestamps
    """
    __tablename__ = "todos"

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
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    is_daily: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    is_disabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    disabled_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True
    )
    reminder_time: Mapped[time | None] = mapped_column(
        Time,
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

    user = relationship("User", backref="todos")

    __table_args__ = (
        Index("ix_todos_user_start_date", "user_id", "start_date"),
    )

    def __repr__(self) -> str:
        return f"<Todo id={self.id} user_id={self.user_id} start_date={self.start_date} is_daily={self.is_daily}>"


class TodoCompletion(Base):
    """
    SQLAlchemy ORM model representing daily completion state for a todo ('todo_completions' table).
    
    For non-daily todos, a record here marks the todo completed on its assigned day.
    For daily recurring todos, a record here marks the specific day checked off without duplicating the todo row.
    
    Fields:
      id: UUID primary key
      todo_id: Foreign key to todos.id
      user_id: Foreign key to users.id
      date: Calendar date (YYYY-MM-DD)
      completed: Completion status flag (True = completed)
      completed_at: When the task was checked off
    """
    __tablename__ = "todo_completions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    todo_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("todos.id", ondelete="CASCADE"),
        nullable=False,
        index=True
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
    completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    todo = relationship("Todo", backref="completions")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("todo_id", "date", name="uq_todo_completion_todo_date"),
        Index("ix_todo_completions_user_date", "user_id", "date"),
    )

    def __repr__(self) -> str:
        return f"<TodoCompletion id={self.id} todo_id={self.todo_id} date={self.date} completed={self.completed}>"
