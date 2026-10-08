import time
import jwt
from app.core.security import hash_password, verify_password, create_session_token, decode_session_token
from app.core.config import settings


def test_password_hashing():
    """Test Argon2id password hashing and verification."""
    password = "SuperSecretPassword!456"
    hashed = hash_password(password)

    # Hash should not be plaintext
    assert hashed != password
    # Argon2id hashes start with $argon2id$
    assert hashed.startswith("$argon2id$")

    # Correct password verifies
    assert verify_password(password, hashed) is True

    # Wrong password fails
    assert verify_password("WrongPassword!456", hashed) is False


def test_session_token_create_and_decode():
    """Test session token generation and valid decoding."""
    user_id = "12345678-1234-5678-1234-567812345678"
    token = create_session_token(user_id)
    decoded_id = decode_session_token(token)
    assert decoded_id == user_id


def test_tampered_token_rejected():
    """Test that a tampered or invalid token is safely rejected."""
    tampered_token = "invalid.token.payload"
    assert decode_session_token(tampered_token) is None


def test_expired_token_rejected():
    """Test that an expired token returns None."""
    expired_payload = {
        "sub": "some-user-id",
        "exp": int(time.time()) - 3600  # 1 hour ago
    }
    expired_token = jwt.encode(expired_payload, settings.AUTH_SECRET, algorithm="HS256")
    assert decode_session_token(expired_token) is None
