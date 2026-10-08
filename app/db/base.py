from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.0 Base class for all ORM models.
    All models (User, TimeEntry, CalendarNote) will inherit from this Base.
    """
    pass
