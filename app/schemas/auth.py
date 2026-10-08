import uuid
import zoneinfo
from datetime import datetime
import re
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict


def is_valid_iana_timezone(tz: str) -> bool:
    """Checks whether a string is a valid IANA timezone name."""
    try:
        zoneinfo.ZoneInfo(tz)
        return True
    except Exception:
        return False


class UserRegister(BaseModel):
    """
    Schema for user registration request.
    Username is required (or derived from email if email is provided).
    Email is optional.
    """
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=30,
        pattern=r"^[a-zA-Z0-9_]+$",
        description="Username must be 3-30 characters, alphanumeric and underscore only"
    )
    email: EmailStr | None = Field(default=None, description="Optional email address")
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    name: str = Field(min_length=1, max_length=100, description="Display name")
    timezone: str = Field(default="UTC", description="IANA timezone name, e.g. 'Asia/Kolkata'")

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        if not is_valid_iana_timezone(v):
            raise ValueError(f"'{v}' is not a valid IANA timezone name (e.g., 'Asia/Kolkata', 'UTC', 'America/New_York').")
        return v

    @model_validator(mode="after")
    def validate_identity(self) -> "UserRegister":
        if not self.username and not self.email:
            raise ValueError("Either username or email is required.")
        if not self.username and self.email:
            base = re.sub(r"[^a-zA-Z0-9_]", "", self.email.split("@")[0])
            if len(base) < 3:
                base = f"user_{base}"
            self.username = base[:30]
        return self


class UserLogin(BaseModel):
    """
    Schema for user login request.
    Supports login by username or email.
    """
    identifier: str | None = Field(default=None, description="Username or Email")
    email: str | None = Field(default=None, description="Legacy email field for backward compatibility")
    password: str

    @model_validator(mode="after")
    def validate_identifier(self) -> "UserLogin":
        if not self.identifier and not self.email:
            raise ValueError("Username or email is required.")
        if not self.identifier and self.email:
            self.identifier = self.email
        return self


class UserResponse(BaseModel):
    """
    Schema returned to clients representing safe user details.
    Notice that password_hash is strictly excluded!
    """
    id: uuid.UUID
    username: str
    email: str | None = None
    name: str
    timezone: str
    created_at: datetime

    # from_attributes=True allows Pydantic to read directly from SQLAlchemy User model instances
    model_config = ConfigDict(from_attributes=True)


class ChangePassword(BaseModel):
    """
    Schema for changing password.
    """
    current_password: str
    new_password: str = Field(min_length=8, description="New password must be at least 8 characters")


class UpdateProfile(BaseModel):
    """
    Schema for updating user profile info (name and/or timezone).
    """
    name: str | None = Field(default=None, min_length=1, max_length=100)
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        if v is not None and not is_valid_iana_timezone(v):
            raise ValueError(f"'{v}' is not a valid IANA timezone name.")
        return v
