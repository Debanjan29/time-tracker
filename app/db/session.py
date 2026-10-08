from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

# Engine configuration:
# pool_pre_ping=True ensures stale or severed database connections are detected and reconnected,
# which is essential for cloud/serverless deployments.
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args
)

# SessionLocal is our factory for creating new database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy database session per request.
    
    How it works:
    1. A route declares `db: Session = Depends(get_db)`.
    2. FastAPI executes code up to `yield db`, giving the route access to the database.
    3. When the route finishes (even if an error occurs), the `finally` block runs,
       closing the session safely to prevent connection leaks.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
