from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import jwt

from app.core.config import settings

# Initialize Argon2 password hasher (Argon2id is the default and recommended variant)
_ph = PasswordHasher()

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using Argon2id.
    Argon2 automatically handles salt generation and secure hashing.
    """
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies that a plaintext password matches the stored Argon2 hash.
    Returns True if valid, False otherwise.
    """
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False


def create_session_token(user_id: str) -> str:
    """
    Creates a signed JWT session token for the user.
    We embed the user_id (as 'sub') and an expiration timestamp ('exp').
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.SESSION_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.AUTH_SECRET, algorithm=ALGORITHM)


def decode_session_token(token: str) -> str | None:
    """
    Decodes and validates a session token.
    Returns the user_id (string) if valid, or None if expired or invalid.
    """
    try:
        payload = jwt.decode(token, settings.AUTH_SECRET, algorithms=[ALGORITHM])
        return payload.get("sub")
    except (jwt.PyJWTError, Exception):
        return None
