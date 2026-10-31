import uuid
from datetime import date


def _create_user(client, email="todo_user@example.com", username="todotester"):
    res = client.post("/auth/register", json={
        "username": username,
        "email": email,
        "password": "Password123!",
        "name": "Todo Tester",
        "timezone": "UTC"
    })
    assert res.status_code == 201
    return res.json()


def test_create_and_fetch_single_day_todo(client):
    """Test creating a non-daily todo and fetching it for that day."""
    _create_user(client, email="u1@example.com", username="user1")

    # 1. Create a task for 2026-10-10
    create_res = client.post("/todos", json={
        "text": "Review pull request #42",
        "start_date": "2026-10-10",
        "is_daily": False
    })
    assert create_res.status_code == 201
    todo_data = create_res.json()
    assert todo_data["text"] == "Review pull request #42"
    assert todo_data["start_date"] == "2026-10-10"
    assert todo_data["is_daily"] is False
    assert todo_data["completed"] is False

    # 2. Fetch for target date
    get_res = client.get("/todos/date/2026-10-10")
    assert get_res.status_code == 200
    items = get_res.json()
    assert len(items) == 1
    assert items[0]["text"] == "Review pull request #42"
    assert items[0]["completed"] is False

    # 3. Fetch for another date - should NOT appear
    get_other = client.get("/todos/date/2026-10-11")
    assert get_other.status_code == 200
    assert len(get_other.json()) == 0


def test_daily_recurring_todo_spread(client):
    """Test that is_daily=True appears on start_date and future days, but not before start_date."""
    _create_user(client, email="u2@example.com", username="user2")

    # Create daily recurring task starting on 2026-10-10
    res = client.post("/todos", json={
        "text": "Daily standup & meditation",
        "start_date": "2026-10-10",
        "is_daily": True
    })
    assert res.status_code == 201
    todo_id = res.json()["id"]

    # Before start_date -> does NOT appear
    before_res = client.get("/todos/date/2026-10-09")
    assert len(before_res.json()) == 0

    # On start_date -> appears
    today_res = client.get("/todos/date/2026-10-10")
    assert len(today_res.json()) == 1
    assert today_res.json()[0]["id"] == todo_id
    assert today_res.json()[0]["completed"] is False

    # Next day -> appears
    next_res = client.get("/todos/date/2026-10-11")
    assert len(next_res.json()) == 1
    assert next_res.json()[0]["id"] == todo_id
    assert next_res.json()[0]["completed"] is False

    # 15 days later -> still appears
    future_res = client.get("/todos/date/2026-10-25")
    assert len(future_res.json()) == 1
    assert future_res.json()[0]["id"] == todo_id


def test_independent_daily_completion_toggle(client):
    """Test completing a recurring task on Day A does not affect Day B."""
    _create_user(client, email="u3@example.com", username="user3")

    create_res = client.post("/todos", json={
        "text": "Drink 2L water",
        "start_date": "2026-10-10",
        "is_daily": True
    })
    todo_id = create_res.json()["id"]

    # 1. Complete on 2026-10-10
    toggle_res = client.post(f"/todos/{todo_id}/toggle/2026-10-10")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["completed"] is True

    # Check 2026-10-10 -> completed is True
    day1_res = client.get("/todos/date/2026-10-10")
    assert day1_res.json()[0]["completed"] is True

    # Check 2026-10-11 -> completed is still False
    day2_res = client.get("/todos/date/2026-10-11")
    assert day2_res.json()[0]["completed"] is False

    # 2. Complete on 2026-10-11 as well
    client.post(f"/todos/{todo_id}/toggle/2026-10-11")
    day2_updated = client.get("/todos/date/2026-10-11")
    assert day2_updated.json()[0]["completed"] is True

    # 3. Untoggle 2026-10-10 -> becomes incomplete
    untoggle_res = client.post(f"/todos/{todo_id}/toggle/2026-10-10")
    assert untoggle_res.json()["completed"] is False

    day1_recheck = client.get("/todos/date/2026-10-10")
    assert day1_recheck.json()[0]["completed"] is False

    # Day 2 remains completed
    day2_recheck = client.get("/todos/date/2026-10-11")
    assert day2_recheck.json()[0]["completed"] is True


def test_disable_daily_recurrence(client):
    """Test disabling daily recurrence stops future appearances while keeping history."""
    _create_user(client, email="u4@example.com", username="user4")

    create_res = client.post("/todos", json={
        "text": "Temporary morning sprint",
        "start_date": "2026-10-10",
        "is_daily": True
    })
    todo_id = create_res.json()["id"]

    # Mark completed on 2026-10-11
    client.post(f"/todos/{todo_id}/toggle/2026-10-11")

    # Disable recurrence starting from 2026-10-14
    disable_res = client.post(f"/todos/{todo_id}/disable", json={
        "disabled_date": "2026-10-14"
    })
    assert disable_res.status_code == 200
    assert disable_res.json()["is_disabled"] is True
    assert disable_res.json()["disabled_date"] == "2026-10-14"

    # Past day (2026-10-11): still visible with its completion!
    hist_res = client.get("/todos/date/2026-10-11")
    assert len(hist_res.json()) == 1
    assert hist_res.json()[0]["completed"] is True

    # Day before disabled date (2026-10-13): still visible
    before_disable_res = client.get("/todos/date/2026-10-13")
    assert len(before_disable_res.json()) == 1

    # On disabled date (2026-10-14): no longer appears!
    on_disable_res = client.get("/todos/date/2026-10-14")
    assert len(on_disable_res.json()) == 0

    # Future date (2026-10-15): no longer appears!
    future_res = client.get("/todos/date/2026-10-15")
    assert len(future_res.json()) == 0


def test_delete_todo(client):
    """Test deleting a todo removes it completely."""
    _create_user(client, email="u5@example.com", username="user5")

    create_res = client.post("/todos", json={
        "text": "Mistaken task",
        "start_date": "2026-10-10",
        "is_daily": False
    })
    todo_id = create_res.json()["id"]

    del_res = client.delete(f"/todos/{todo_id}")
    assert del_res.status_code == 200

    # Ensure it no longer appears in queries
    get_res = client.get("/todos/date/2026-10-10")
    assert len(get_res.json()) == 0


def test_user_data_isolation(client):
    """Test User A's tasks are completely isolated from User B."""
    # User A
    _create_user(client, email="usera@example.com", username="usera")
    res_a = client.post("/todos", json={
        "text": "Secret task A",
        "start_date": "2026-10-10",
        "is_daily": True
    })
    todo_a_id = res_a.json()["id"]

    # User B
    _create_user(client, email="userb@example.com", username="userb")

    # User B queries 2026-10-10 -> should NOT see User A's task
    get_b = client.get("/todos/date/2026-10-10")
    assert len(get_b.json()) == 0

    # User B attempts to toggle User A's task -> 404
    toggle_b = client.post(f"/todos/{todo_a_id}/toggle/2026-10-10")
    assert toggle_b.status_code == 404

    # User B attempts to disable User A's task -> 404
    disable_b = client.post(f"/todos/{todo_a_id}/disable", json={"disabled_date": "2026-10-12"})
    assert disable_b.status_code == 404

    # User B attempts to delete User A's task -> 404
    del_b = client.delete(f"/todos/{todo_a_id}")
    assert del_b.status_code == 404


def test_unauthenticated_access_rejected(client):
    """Test unauthenticated requests are rejected with 401."""
    # No user logged in (clear session or client without login)
    # Logout first if anything is logged in
    client.post("/auth/logout")

    res_get = client.get("/todos/date/2026-10-10")
    assert res_get.status_code == 401

    res_post = client.post("/todos", json={"text": "test", "start_date": "2026-10-10"})
    assert res_post.status_code == 401


def test_create_and_fetch_todo_with_reminder_time(client):
    """Test creating a daily task with a specific reminder time and fetching it."""
    _create_user(client, email="remind_user1@example.com", username="remindtester1")

    create_res = client.post("/todos", json={
        "text": "Daily workout sprint",
        "start_date": "2026-10-10",
        "is_daily": True,
        "reminder_time": "14:30:00"
    })
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["reminder_time"] == "14:30:00"
    assert data["is_daily"] is True

    # Fetch for date
    get_res = client.get("/todos/date/2026-10-10")
    assert get_res.status_code == 200
    items = get_res.json()
    assert len(items) == 1
    assert items[0]["reminder_time"] == "14:30:00"


def test_update_and_clear_todo_reminder_time(client):
    """Test modifying a task's reminder time and clearing it."""
    _create_user(client, email="remind_user2@example.com", username="remindtester2")

    # 1. Create without reminder
    res = client.post("/todos", json={
        "text": "Call accountant",
        "start_date": "2026-10-10",
        "is_daily": False
    })
    assert res.status_code == 201
    todo_id = res.json()["id"]
    assert res.json()["reminder_time"] is None

    # 2. Add reminder time via PATCH
    patch_res = client.patch(f"/todos/{todo_id}", json={
        "reminder_time": "10:15:00",
        "text": "Call chief accountant"
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["reminder_time"] == "10:15:00"
    assert updated["text"] == "Call chief accountant"

    # Verify persistent in database
    get_res = client.get("/todos/date/2026-10-10")
    assert get_res.json()[0]["reminder_time"] == "10:15:00"

    # 3. Clear reminder time
    clear_res = client.patch(f"/todos/{todo_id}", json={
        "clear_reminder": True
    })
    assert clear_res.status_code == 200
    assert clear_res.json()["reminder_time"] is None

    # Verify cleared in query
    get_res2 = client.get("/todos/date/2026-10-10")
    assert get_res2.json()[0]["reminder_time"] is None


def test_update_todo_cross_user_isolation(client):
    """Test User B cannot modify User A's task reminder or text."""
    _create_user(client, email="owner@example.com", username="owneruser")
    res = client.post("/todos", json={
        "text": "Owner personal reminder",
        "start_date": "2026-10-10",
        "reminder_time": "08:00:00"
    })
    todo_id = res.json()["id"]

    # Switch to User B
    _create_user(client, email="attacker@example.com", username="attackeruser")
    hack_res = client.patch(f"/todos/{todo_id}", json={
        "text": "Hacked task",
        "reminder_time": "23:59:00"
    })
    assert hack_res.status_code == 404

