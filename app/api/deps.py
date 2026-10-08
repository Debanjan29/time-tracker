from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import decode_session_token
from app.models.user import User
from app.services.auth import get_user_by_id

# Optional bearer scheme so API tools (like Swagger UI or Postman) can use Authorization header as well
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    auth_header: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)
) -> User:
    """
    FastAPI Dependency to retrieve the currently authenticated user.
    
    Checks in this order:
    1. HTTP-only session cookie (recommended for web browsers)
    2. 'Authorization: Bearer <token>' header (for API clients)
    
    If the session is invalid, expired, or absent, raises 401 Unauthorized.
    """
    token: str | None = None

    # 1. Try reading from cookie
    if settings.COOKIE_NAME in request.cookies:
        token = request.cookies.get(settings.COOKIE_NAME)
    
    # 2. Fallback to Authorization header
    elif auth_header:
        token = auth_header.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decode_session_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
