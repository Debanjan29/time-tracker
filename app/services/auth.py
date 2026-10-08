import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, ChangePassword, UpdateProfile
from app.core.security import hash_password, verify_password


def normalize_email(email: str) -> str:
    """
    Normalizes an email address by stripping whitespace and converting to lowercase.
    Prevents duplicate accounts like 'User@example.com' and 'user@example.com'.
    """
    return email.strip().lower()


def normalize_username(username: str) -> str:
    """
    Normalizes a username by stripping whitespace and converting to lowercase.
    """
    return username.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    """
    Finds a user by normalized email address.
    """
    normalized = normalize_email(email)
    statement = select(User).where(User.email == normalized)
    return db.scalars(statement).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    """
    Finds a user by normalized username.
    """
    normalized = normalize_username(username)
    statement = select(User).where(User.username == normalized)
    return db.scalars(statement).first()


def get_user_by_id(db: Session, user_id: uuid.UUID | str) -> User | None:
    """
    Finds a user by their UUID primary key.
    """
    if isinstance(user_id, str):
        try:
            user_id = uuid.UUID(user_id)
        except ValueError:
            return None
    statement = select(User).where(User.id == user_id)
    return db.scalars(statement).first()


def register_user(db: Session, data: UserRegister) -> User:
    """
    Registers a new user.
    Checks for duplicate username and (if provided) duplicate email.
    """
    norm_username = normalize_username(data.username)
    existing_username = get_user_by_username(db, norm_username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this username already exists."
        )

    norm_email: str | None = None
    if data.email:
        norm_email = normalize_email(data.email)
        existing_email = get_user_by_email(db, norm_email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists."
            )

    # Securely hash the password with Argon2id
    hashed = hash_password(data.password)

    # Create new User ORM instance
    user = User(
        username=norm_username,
        email=norm_email,
        password_hash=hashed,
        name=data.name.strip(),
        timezone=data.timezone
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: UserLogin) -> User:
    """
    Authenticates a user by username or email and password.
    Raises HTTPException 401 if credentials do not match.
    """
    identifier = (data.identifier or data.email or "").strip()
    if "@" in identifier:
        user = get_user_by_email(db, identifier)
    else:
        user = get_user_by_username(db, identifier)

    if not user or not verify_password(data.password, user.password_hash):
        detail_msg = "Invalid email or password." if "@" in identifier else "Invalid username or password."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail_msg
        )
    return user


def change_user_password(db: Session, user: User, data: ChangePassword) -> User:
    """
    Changes a user's password after verifying their current password.
    """
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )
    
    user.password_hash = hash_password(data.new_password)
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(db: Session, user: User, data: UpdateProfile) -> User:
    """
    Updates the user's name or timezone.
    """
    if data.name is not None:
        user.name = data.name.strip()
    if data.timezone is not None:
        user.timezone = data.timezone
    db.commit()
    db.refresh(user)
    return user


def delete_user_account(db: Session, user: User) -> None:
    """
    Deletes the user and all associated data.
    """
    db.delete(user)
    db.commit()
