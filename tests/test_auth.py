def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_root_serves_html(client):
    """Test root endpoint serves the frontend HTML interface."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Personal Time Tracker" in response.text
    assert "text/html" in response.headers["content-type"]


def test_register_success(client):
    """Test successful user registration."""
    payload = {
        "email": "test@example.com",
        "password": "strongpassword123",
        "name": "Alex Smith",
        "timezone": "Asia/Kolkata"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Alex Smith"
    assert data["timezone"] == "Asia/Kolkata"
    assert "id" in data
    # Password hash must NEVER be exposed in response
    assert "password" not in data
    assert "password_hash" not in data

    # Check that session cookie was set
    assert "timelog_session" in response.cookies


def test_register_duplicate_email(client):
    """Test that duplicate email registration is rejected."""
    payload = {
        "email": "duplicate@example.com",
        "password": "password123",
        "name": "First User",
        "timezone": "UTC"
    }
    res1 = client.post("/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with exact same email
    res2 = client.post("/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_register_email_normalization(client):
    """Test that email addresses are case-normalized and trimmed."""
    payload1 = {
        "email": "CaseTest@EXAMPLE.com",
        "password": "password123",
        "name": "Case User",
        "timezone": "UTC"
    }
    res1 = client.post("/auth/register", json=payload1)
    assert res1.status_code == 201
    assert res1.json()["email"] == "casetest@example.com"

    # Registering with lowercase version should be detected as duplicate
    payload2 = {
        "email": "  casetest@example.com  ",
        "password": "password123",
        "name": "Case User 2",
        "timezone": "UTC"
    }
    res2 = client.post("/auth/register", json=payload2)
    assert res2.status_code == 400


def test_register_invalid_timezone(client):
    """Test that invalid IANA timezone is rejected with validation error."""
    payload = {
        "email": "invalidtz@example.com",
        "password": "password123",
        "name": "Invalid TZ",
        "timezone": "Not/A/Timezone"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 422


def test_register_short_password(client):
    """Test that password shorter than 8 characters is rejected."""
    payload = {
        "email": "shortpass@example.com",
        "password": "short",
        "name": "Short Pass",
        "timezone": "UTC"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 422


def test_login_success(client):
    """Test login with correct credentials."""
    # Register first
    client.post("/auth/register", json={
        "email": "login@example.com",
        "password": "mypassword123",
        "name": "Login User",
        "timezone": "America/New_York"
    })

    # Login
    response = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "mypassword123"
    })
    assert response.status_code == 200
    assert response.json()["email"] == "login@example.com"
    assert "timelog_session" in response.cookies


def test_login_invalid_password(client):
    """Test login with wrong password."""
    client.post("/auth/register", json={
        "email": "wrongpass@example.com",
        "password": "correctpassword",
        "name": "User",
        "timezone": "UTC"
    })

    response = client.post("/auth/login", json={
        "email": "wrongpass@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_login_nonexistent_user(client):
    """Test login with an unregistered email."""
    response = client.post("/auth/login", json={
        "email": "ghost@example.com",
        "password": "any_password"
    })
    assert response.status_code == 401


def test_logout(client):
    """Test logout clears the session cookie."""
    client.post("/auth/register", json={
        "email": "logout@example.com",
        "password": "password123",
        "name": "Logout User",
        "timezone": "UTC"
    })

    response = client.post("/auth/logout")
    assert response.status_code == 200
    # Cookie should either be empty or expired
    assert response.cookies.get("timelog_session") == "" or "timelog_session" not in response.cookies


def test_get_me_authenticated(client):
    """Test GET /auth/me returns current user profile when authenticated."""
    client.post("/auth/register", json={
        "email": "me@example.com",
        "password": "password123",
        "name": "Me User",
        "timezone": "Europe/London"
    })

    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Me User"
    assert data["timezone"] == "Europe/London"


def test_get_me_unauthenticated(client):
    """Test GET /auth/me returns 401 when not authenticated."""
    # Clear cookies by creating a fresh request without session
    client.cookies.clear()
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_change_password(client):
    """Test changing user password."""
    client.post("/auth/register", json={
        "email": "changepw@example.com",
        "password": "oldpassword123",
        "name": "PW User",
        "timezone": "UTC"
    })

    # Change password
    res = client.post("/account/change-password", json={
        "current_password": "oldpassword123",
        "new_password": "newpassword456"
    })
    assert res.status_code == 200

    # Old password should no longer work
    fail_res = client.post("/auth/login", json={
        "email": "changepw@example.com",
        "password": "oldpassword123"
    })
    assert fail_res.status_code == 401

    # New password should work
    ok_res = client.post("/auth/login", json={
        "email": "changepw@example.com",
        "password": "newpassword456"
    })
    assert ok_res.status_code == 200


def test_delete_account(client):
    """Test account deletion."""
    client.post("/auth/register", json={
        "email": "delete@example.com",
        "password": "password123",
        "name": "Delete User",
        "timezone": "UTC"
    })

    # Delete account
    res = client.delete("/account")
    assert res.status_code == 200

    # User cannot log in anymore
    login_res = client.post("/auth/login", json={
        "email": "delete@example.com",
        "password": "password123"
    })
    assert login_res.status_code == 401


def test_register_with_username_no_email(client):
    """Test registering with username only (no email address)."""
    payload = {
        "username": "coder_bob",
        "password": "secretpassword123",
        "name": "Bob Coder",
        "timezone": "UTC"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "coder_bob"
    assert data["email"] is None
    assert data["name"] == "Bob Coder"


def test_login_with_username(client):
    """Test login using username instead of email."""
    client.post("/auth/register", json={
        "username": "sarah_connor",
        "password": "terminatorpassword",
        "name": "Sarah",
        "timezone": "UTC"
    })

    # Log in using identifier = username
    res = client.post("/auth/login", json={
        "identifier": "sarah_connor",
        "password": "terminatorpassword"
    })
    assert res.status_code == 200
    assert res.json()["username"] == "sarah_connor"
    assert "timelog_session" in res.cookies


def test_register_duplicate_username(client):
    """Test duplicate username is rejected."""
    payload1 = {
        "username": "unique_hero",
        "password": "password123",
        "name": "Hero 1",
        "timezone": "UTC"
    }
    res1 = client.post("/auth/register", json=payload1)
    assert res1.status_code == 201

    payload2 = {
        "username": "unique_hero",
        "password": "password456",
        "name": "Hero 2",
        "timezone": "UTC"
    }
    res2 = client.post("/auth/register", json=payload2)
    assert res2.status_code == 400
    assert "username already exists" in res2.json()["detail"]
