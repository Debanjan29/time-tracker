import uuid
from datetime import datetime, date, timedelta, timezone


def _create_authenticated_user(client, email="calendar_user@example.com"):
    res = client.post("/auth/register", json={
        "email": email,
        "password": "password123",
        "name": "Calendar Tester",
        "timezone": "UTC"
    })
    assert res.status_code == 201
    return res.json()


def test_get_month_calendar_empty(client):
    """Test retrieving monthly calendar when no entries exist."""
    _create_authenticated_user(client)

    response = client.get("/calendar/month/2026/10")
    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2026
    assert data["month"] == 10
    assert data["month_name"] == "October"
    assert data["days_in_month"] == 31
    assert len(data["days"]) == 31
    # Check that day 1 has no entries and no notes
    assert data["days"][0]["day_number"] == 1
    assert data["days"][0]["has_entries"] is False
    assert data["days"][0]["has_notes"] is False


def test_calendar_indicators_with_entries_and_notes(client):
    """Test that calendar indicators show has_entries, has_notes, and both."""
    _create_authenticated_user(client)

    # 1. Add completed entry for Oct 10, 2026 (10:00 to 12:00 UTC = 2 hours)
    client.post("/time/manual", json={
        "start_time": "2026-10-01T09:00:00Z",
        "end_time": "2026-10-01T11:00:00Z",
        "note": "Work session"
    })

    # 2. Add planning note for Oct 20, 2026
    client.post("/calendar-notes", json={
        "date": "2026-10-20",
        "note": "Planning review meeting"
    })

    # 3. Add both entry and note for Oct 2, 2026 (past date)
    m_res = client.post("/time/manual", json={
        "start_time": "2026-10-02T08:00:00Z",
        "end_time": "2026-10-02T09:30:00Z",
        "note": "Work session on 2nd"
    })
    assert m_res.status_code == 201

    c_res = client.post("/calendar-notes", json={
        "date": "2026-10-02",
        "note": "Reminder on 2nd"
    })
    assert c_res.status_code == 201

    # Fetch October 2026 calendar
    res = client.get("/calendar/month/2026/10")
    assert res.status_code == 200
    days = {d["day_number"]: d for d in res.json()["days"]}

    # Day 1: has entries, no notes
    assert days[1]["has_entries"] is True
    assert days[1]["has_notes"] is False
    assert days[1]["total_duration_seconds"] == 7200  # 2 hours

    # Day 20: has notes, no entries
    assert days[20]["has_entries"] is False
    assert days[20]["has_notes"] is True
    # Crucial rule: CalendarNote must NEVER contribute to tracked hours!
    assert days[20]["total_duration_seconds"] == 0

    # Day 2: has BOTH entries and notes
    assert days[2]["has_entries"] is True
    assert days[2]["has_notes"] is True
    assert days[2]["total_duration_seconds"] == 5400  # 1.5 hours


def test_calendar_note_crud(client):
    """Test full CRUD cycle for calendar planning notes."""
    _create_authenticated_user(client)

    future_date = "2026-11-15"

    # Create note
    create_res = client.post("/calendar-notes", json={
        "date": future_date,
        "note": "Plan deployment"
    })
    assert create_res.status_code == 201
    note_id = create_res.json()["id"]
    assert create_res.json()["note"] == "Plan deployment"

    # Read notes for date
    get_res = client.get(f"/calendar-notes/date/{future_date}")
    assert get_res.status_code == 200
    assert len(get_res.json()) == 1
    assert get_res.json()[0]["id"] == note_id

    # Edit note
    edit_res = client.patch(f"/calendar-notes/{note_id}", json={
        "note": "Updated plan deployment"
    })
    assert edit_res.status_code == 200
    assert edit_res.json()["note"] == "Updated plan deployment"

    # Delete note
    del_res = client.delete(f"/calendar-notes/{note_id}")
    assert del_res.status_code == 200

    # Verify deleted
    after_del = client.get(f"/calendar-notes/date/{future_date}")
    assert len(after_del.json()) == 0


def test_future_restrictions_rule(client):
    """
    Test Rule 6 & Section 20:
    Future dates allow CalendarNote, but strictly forbid TimeEntry.
    """
    _create_authenticated_user(client)

    future_date_str = "2026-12-25"

    # 1. CalendarNote on future date: MUST SUCCEED
    note_res = client.post("/calendar-notes", json={
        "date": future_date_str,
        "note": "Christmas holiday planning"
    })
    assert note_res.status_code == 201

    # 2. TimeEntry on future date: MUST BE REJECTED
    entry_res = client.post("/time/manual", json={
        "start_time": f"{future_date_str}T09:00:00Z",
        "end_time": f"{future_date_str}T11:00:00Z",
        "note": "Future time entry"
    })
    assert entry_res.status_code == 422


def test_calendar_notes_user_isolation(client):
    """Test Section 25: User A cannot see, edit, or delete User B's calendar notes."""
    _create_authenticated_user(client, email="usera_cal@example.com")
    c_res = client.post("/calendar-notes", json={
        "date": "2026-10-30",
        "note": "User A confidential plan"
    })
    note_a_id = c_res.json()["id"]

    # Log in as User B
    client.cookies.clear()
    _create_authenticated_user(client, email="userb_cal@example.com")

    # User B should see 0 notes for that date
    b_get = client.get("/calendar-notes/date/2026-10-30")
    assert len(b_get.json()) == 0

    # User B cannot edit
    b_edit = client.patch(f"/calendar-notes/{note_a_id}", json={"note": "Hacked"})
    assert b_edit.status_code == 404

    # User B cannot delete
    b_del = client.delete(f"/calendar-notes/{note_a_id}")
    assert b_del.status_code == 404
