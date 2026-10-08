from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserResponse
from app.services.auth import register_user, authenticate_user
from app.core.security import create_session_token
from app.core.config import settings
from app.api.deps import get_current_user

# APIRouter allows organizing endpoints into modular, dedicated files
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookie(response: Response, user_id: str) -> None:
    """Helper to issue a secure, HTTP-only session cookie."""
    token = create_session_token(user_id)
    max_age_seconds = settings.SESSION_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,         # JavaScript cannot access the cookie (protects against XSS)
        secure=settings.COOKIE_SECURE,  # True in production (HTTPS only)
        samesite=settings.COOKIE_SAMESITE,  # CSRF defense
        max_age=max_age_seconds
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user"
)
def register(
    data: UserRegister,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Registers a new user account.
    - Validates email format and password length.
    - Hashes password using Argon2id.
    - Creates user in the database.
    - Automatically sets an authenticated HTTP-only session cookie.
    """
    user = register_user(db, data)
    _set_auth_cookie(response, str(user.id))
    return user


@router.post(
    "/login",
    response_model=UserResponse,
    summary="Log in to an existing account"
)
def login(
    data: UserLogin,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticates a user with email and password.
    Sets an HTTP-only session cookie on success.
    """
    user = authenticate_user(db, data)
    _set_auth_cookie(response, str(user.id))
    return user


@router.post(
    "/logout",
    summary="Log out of the current account"
)
def logout(response: Response):
    """
    Logs out the user by clearing the session cookie.
    """
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "Logged out successfully."}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile"
)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently logged-in user.
    Demonstrates FastAPI's `Depends(get_current_user)` authentication guard.
    """
    return current_user
