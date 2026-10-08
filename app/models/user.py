import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    """
    SQLAlchemy ORM model representing the 'users' table.
    
    Fields:
      id: UUID primary key
      email: Unique, normalized email address
      password_hash: Argon2id hash of the user's password
      name: User's display name
      timezone: IANA timezone identifier (e.g., 'Asia/Kolkata')
      created_at: Timezone-aware timestamp when user registered
      updated_at: Timezone-aware timestamp when user was last updated
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: f"user_{uuid.uuid4().hex[:8]}"
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="UTC"
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

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} email={self.email} timezone={self.timezone}>"
