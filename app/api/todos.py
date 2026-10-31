import uuid
from datetime import date
from fastapi import APIRouter, Depends, status, Path
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.todo import (
    TodoCreate,
    TodoUpdate,
    TodoResponse,
    TodoToggleRequest,
    TodoToggleResponse,
    TodoDisableRequest
)
from app.services.todo import (
    get_todos_for_date,
    create_todo,
    update_todo,
    toggle_todo_completion,
    disable_todo_recurrence,
    delete_todo
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/todos", tags=["Daily To-Dos"])


@router.get("/date/{target_date}", response_model=list[TodoResponse], summary="Get tasks for a specific date")
def get_daily_todos(
    target_date: date = Path(description="Target date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all tasks for the given calendar date (including active daily recurring tasks)
    along with their completion status for that specific day.
    """
    return get_todos_for_date(db, current_user, target_date)


@router.post("", response_model=TodoResponse, status_code=status.HTTP_201_CREATED, summary="Create a new task")
def add_todo(
    data: TodoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new task. If is_daily is true, the task will repeat on all future dates until disabled.
    """
    return create_todo(db, current_user, data)


@router.post("/{todo_id}/toggle/{target_date}", response_model=TodoToggleResponse, summary="Toggle task completion for a date")
def toggle_todo(
    todo_id: uuid.UUID = Path(description="UUID of the todo"),
    target_date: date = Path(description="Calendar date in YYYY-MM-DD format"),
    payload: TodoToggleRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggles completion state (or sets explicit completed state) for the task on target_date.
    """
    explicit = payload.completed if payload else None
    return toggle_todo_completion(db, current_user, todo_id, target_date, explicit)


@router.post("/{todo_id}/disable", response_model=TodoResponse, summary="Disable future recurrence of a daily task")
def disable_recurrence(
    todo_id: uuid.UUID = Path(description="UUID of the todo"),
    payload: TodoDisableRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stops a daily recurring task from appearing on future days.
    History prior to the disabled date remains preserved.
    """
    disabled_date = payload.disabled_date if (payload and payload.disabled_date) else date.today()
    return disable_todo_recurrence(db, current_user, todo_id, disabled_date)


@router.patch("/{todo_id}", response_model=TodoResponse, summary="Update task text, recurrence, or reminder")
def modify_todo(
    data: TodoUpdate,
    todo_id: uuid.UUID = Path(description="UUID of the todo"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates an existing task's description, recurrence, or reminder time.
    """
    return update_todo(db, current_user, todo_id, data)


@router.delete("/{todo_id}", status_code=status.HTTP_200_OK, summary="Delete a task")
def remove_todo(
    todo_id: uuid.UUID = Path(description="UUID of the todo"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Permanently deletes a task and all associated daily logs.
    """
    delete_todo(db, current_user, todo_id)
    return {"message": "Task deleted successfully."}
