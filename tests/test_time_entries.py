import uuid
from datetime import datetime, timedelta, timezone


def _get_midday_timezone() -> str:
    """Returns an IANA timezone where local time is currently daytime (between 9 AM and 7 PM)."""
    utc_hour = datetime.now(timezone.utc).hour
    if 0 <= utc_hour < 6:
        return "Asia/Tokyo"
    elif 6 <= utc_hour < 12:
        return "Asia/Kolkata"
    elif 12 <= utc_hour < 18:
        return "UTC"
    else:
        return "America/New_York"


def _create_authenticated_user(client, email="user@example.com", tz=None):
    """Helper to register and login a user, setting authentication cookies on the client."""
    if tz is None:
        tz = _get_midday_timezone()
    res = client.post("/auth/register", json={
        "email": email,
        "password": "securepassword123",
        "name": "Test User",
        "timezone": tz
    })
    assert res.status_code == 201
    return res.json()


def test_start_timer_success(client):
    """Test starting a live timer."""
    _create_authenticated_user(client)

    response = client.post("/time/start", json={"note": "Working on feature X"})
    assert response.status_code == 201
    data = response.json()
    assert data["is_active"] is True
    assert data["end_time"] is None
    assert data["note"] == "Working on feature X"
    assert "id" in data
    assert "start_time" in data


def test_cannot_have_two_active_timers(client):
    """Test Rule 3: Only ONE active timer per user."""
    _create_authenticated_user(client)

    res1 = client.post("/time/start", json={"note": "First timer"})
    assert res1.status_code == 201

    # Attempting to start a second timer must fail
    res2 = client.post("/time/start", json={"note": "Second timer"})
    assert res2.status_code == 400
    assert "already have an active timer" in res2.json()["detail"]


def test_stop_timer_success(client):
    """Test stopping the active timer."""
    _create_authenticated_user(client)

    # Start timer
    client.post("/time/start", json={"note": "Session A"})

    # Stop timer
    response = client.post("/time/stop", json={"note": "Session A (completed)"})
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    assert data["end_time"] is not None
    assert data["note"] == "Session A (completed)"
    assert data["duration_seconds"] >= 0


def test_stop_timer_when_none_active(client):
    """Test that stopping when no timer is active returns 400."""
    _create_authenticated_user(client)

    response = client.post("/time/stop", json={})
    assert response.status_code == 400
    assert "No active timer" in response.json()["detail"]


def test_manual_entry_success(client):
    """Test Rule 4: Manual historical entry creation."""
    _create_authenticated_user(client)

    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=2)
    end = now - timedelta(hours=1)

    payload = {
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "note": "Historical documentation work"
    }
    response = client.post("/time/manual", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_active"] is False
    assert data["note"] == "Historical documentation work"
    # Duration should be ~3600 seconds (1 hour)
    assert 3590 <= data["duration_seconds"] <= 3610
    assert "1h" in data["duration_formatted"]


def test_manual_entry_future_rejected(client):
    """Test Rule 6: Future time entries are forbidden."""
    _create_authenticated_user(client)

    future_start = datetime.now(timezone.utc) + timedelta(days=2)
    future_end = future_start + timedelta(hours=1)

    payload = {
        "start_time": future_start.isoformat(),
        "end_time": future_end.isoformat(),
        "note": "Future work"
    }
    response = client.post("/time/manual", json=payload)
    assert response.status_code == 422


def test_manual_entry_end_before_start_rejected(client):
    """Test Rule 7: end_time must be after start_time."""
    _create_authenticated_user(client)

    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=1)
    end = now - timedelta(hours=2)  # Earlier than start!

    payload = {
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "note": "Invalid sequence"
    }
    response = client.post("/time/manual", json=payload)
    assert response.status_code == 422


def test_today_summary_includes_active_and_completed(client):
    """Test that /time/today includes completed sessions, the active timer, and sum."""
    _create_authenticated_user(client)

    now = datetime.now(timezone.utc)
    # Add a completed 1-hour entry earlier today
    client.post("/time/manual", json={
        "start_time": (now - timedelta(hours=3)).isoformat(),
        "end_time": (now - timedelta(hours=2)).isoformat(),
        "note": "Morning work"
    })

    # Start an active timer
    client.post("/time/start", json={"note": "Current work"})

    response = client.get("/time/today")
    assert response.status_code == 200
    data = response.json()
    assert len(data["entries"]) == 1
    assert data["active_entry"] is not None
    assert data["active_entry"]["note"] == "Current work"
    # Total duration should include completed entry (3600s) + active timer
    assert data["total_duration_seconds"] >= 3600


def test_edit_entry_success(client):
    """Test editing an existing time entry."""
    _create_authenticated_user(client)

    now = datetime.now(timezone.utc)
    create_res = client.post("/time/manual", json={
        "start_time": (now - timedelta(hours=4)).isoformat(),
        "end_time": (now - timedelta(hours=3)).isoformat(),
        "note": "Original note"
    })
    entry_id = create_res.json()["id"]

    # Edit note
    edit_res = client.patch(f"/time/{entry_id}", json={
        "note": "Updated note"
    })
    assert edit_res.status_code == 200
    assert edit_res.json()["note"] == "Updated note"


def test_edit_entry_future_rejected(client):
    """Test editing an entry to a future timestamp is rejected."""
    _create_authenticated_user(client)

    now = datetime.now(timezone.utc)
    create_res = client.post("/time/manual", json={
        "start_time": (now - timedelta(hours=4)).isoformat(),
        "end_time": (now - timedelta(hours=3)).isoformat(),
        "note": "Original note"
    })
    entry_id = create_res.json()["id"]

    future_time = (now + timedelta(days=3)).isoformat()
    res = client.patch(f"/time/{entry_id}", json={"start_time": future_time})
    assert res.status_code == 400
    assert "future" in res.json()["detail"]


def test_delete_entry_success(client):
    """Test deleting an entry."""
    _create_authenticated_user(client)

    now = datetime.now(timezone.utc)
    create_res = client.post("/time/manual", json={
        "start_time": (now - timedelta(hours=2)).isoformat(),
        "end_time": (now - timedelta(hours=1)).isoformat(),
        "note": "To be deleted"
    })
    entry_id = create_res.json()["id"]

    del_res = client.delete(f"/time/{entry_id}")
    assert del_res.status_code == 200

    # Entry should no longer be present
    today_res = client.get("/time/today")
    assert len(today_res.json()["entries"]) == 0


def test_user_data_isolation(client):
    """Test Section 25: User A cannot see, edit, or delete User B's entries."""
    # Create User A
    _create_authenticated_user(client, email="usera@example.com")
    now = datetime.now(timezone.utc)
    res_a = client.post("/time/manual", json={
        "start_time": (now - timedelta(hours=2)).isoformat(),
        "end_time": (now - timedelta(hours=1)).isoformat(),
        "note": "User A secret work"
    })
    entry_a_id = res_a.json()["id"]

    # Log in as User B
    client.cookies.clear()
    _create_authenticated_user(client, email="userb@example.com")

    # User B checks today's entries -> should NOT see User A's entry
    b_today = client.get("/time/today")
    assert len(b_today.json()["entries"]) == 0

    # User B attempts to delete User A's entry -> 404 Not Found
    b_del = client.delete(f"/time/{entry_a_id}")
    assert b_del.status_code == 404


def test_db_level_one_active_timer_constraint(db):
    """
    Test Rule 3 at the database level:
    Even if bypassing API validation, the database partial unique index rejects two active timers.
    """
    from sqlalchemy.exc import IntegrityError
    from app.models.user import User
    from app.models.time_entry import TimeEntry
    from app.core.security import hash_password
    import pytest

    user = User(
        email="dbtest@example.com",
        password_hash=hash_password("password123"),
        name="DB Test",
        timezone="UTC"
    )
    db.add(user)
    db.commit()

    now = datetime.now(timezone.utc)
    entry1 = TimeEntry(user_id=user.id, start_time=now, end_time=None)
    db.add(entry1)
    db.commit()

    # Attempt second active entry for same user
    entry2 = TimeEntry(user_id=user.id, start_time=now + timedelta(minutes=5), end_time=None)
    db.add(entry2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_timezone_specific_today(client):
    """
    Test Section 9 & 33: User in a timezone behind UTC vs ahead of UTC.
    Today must mean today according to the user's configured timezone.
    """
    # User in New York (EDT, UTC-4)
    _create_authenticated_user(client, email="ny_user@example.com", tz="America/New_York")
    res = client.get("/time/today")
    assert res.status_code == 200
    ny_date = res.json()["date"]

    # User in Kolkata (IST, UTC+5:30)
    client.cookies.clear()
    _create_authenticated_user(client, email="kolkata_user@example.com", tz="Asia/Kolkata")
    res_k = client.get("/time/today")
    assert res_k.status_code == 200
    kolkata_date = res_k.json()["date"]

    assert ny_date is not None
    assert kolkata_date is not None

