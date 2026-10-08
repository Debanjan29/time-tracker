from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings.
    
    FastAPI and Pydantic read these values from environment variables or a .env file.
    This gives us strong typing, default values, and prevents hardcoding secrets.
    """
    APP_NAME: str = "Personal Time Tracker"
    ENVIRONMENT: str = "development"
    
    # Database connection string
    # In PostgreSQL, standard format: postgresql+psycopg2://user:password@host:port/dbname
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/timelog_db"
    
    # Secret key used for signing authentication cookies/tokens
    # Must be kept secret in production!
    AUTH_SECRET: str = "dev-insecure-secret-key-change-in-production-12345678"
    
    # Cookie & session settings
    COOKIE_NAME: str = "timelog_session"
    COOKIE_SECURE: bool = False  # Set to True in production (requires HTTPS)
    COOKIE_SAMESITE: str = "lax"
    SESSION_EXPIRE_DAYS: int = 7

    # Pydantic Settings configuration: tells it to look for a .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached instance of Settings.
    Using @lru_cache ensures the .env file is only parsed once instead of on every request.
    """
    return Settings()


settings = get_settings()
