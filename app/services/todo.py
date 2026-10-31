import uuid
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from fastapi import HTTPException, status

from app.models.user import User
from app.models.todo import Todo, TodoCompletion
from app.schemas.todo import (
    TodoCreate,
    TodoResponse,
    TodoToggleResponse,
    TodoUpdate
)


def get_todos_for_date(db: Session, user: User, target_date: date) -> list[TodoResponse]:
    """
    Retrieves all tasks for the user applicable to target_date:
    1. Single-day tasks where start_date == target_date.
    2. Daily recurring tasks where start_date <= target_date, unless disabled before target_date.
    Includes the day-specific completion status.
    """
    statement = (
        select(Todo)
        .where(
            and_(
                Todo.user_id == user.id,
                or_(
                    # Single-day tasks scheduled for this date
                    and_(
                        Todo.is_daily.is_(False),
                        Todo.start_date == target_date
                    ),
                    # Daily recurring tasks starting on or before this date
                    and_(
                        Todo.is_daily.is_(True),
                        Todo.start_date <= target_date,
                        or_(
                            Todo.is_disabled.is_(False),
                            and_(
                                Todo.is_disabled.is_(True),
                                Todo.disabled_date.is_not(None),
                                target_date < Todo.disabled_date
                            )
                        )
                    )
                )
            )
        )
        .order_by(Todo.created_at.asc())
    )
    todos = list(db.scalars(statement).all())
    if not todos:
        return []

    todo_ids = [t.id for t in todos]

    # Fetch completion records for these todos on target_date
    comp_stmt = select(TodoCompletion).where(
        and_(
            TodoCompletion.todo_id.in_(todo_ids),
            TodoCompletion.user_id == user.id,
            TodoCompletion.date == target_date,
            TodoCompletion.completed.is_(True)
        )
    )
    completed_ids = {c.todo_id for c in db.scalars(comp_stmt).all()}

    # Build response list
    results: list[TodoResponse] = []
    for t in todos:
        is_done = t.id in completed_ids
        results.append(
            TodoResponse(
                id=t.id,
                user_id=t.user_id,
                text=t.text,
                start_date=t.start_date,
                is_daily=t.is_daily,
                is_disabled=t.is_disabled,
                disabled_date=t.disabled_date,
                reminder_time=t.reminder_time,
                completed=is_done,
                created_at=t.created_at,
                updated_at=t.updated_at
            )
        )

    # Sort so active/uncompleted tasks come first, completed strikethrough tasks sink to bottom
    results.sort(key=lambda item: (item.completed, item.created_at))
    return results


def create_todo(db: Session, user: User, data: TodoCreate) -> TodoResponse:
    """
    Creates a new task.
    If is_daily=True, the task automatically manifests on target_date and all future dates.
    """
    cleaned_text = data.text.strip()
    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task description cannot be empty."
        )

    todo = Todo(
        user_id=user.id,
        text=cleaned_text,
        start_date=data.start_date,
        is_daily=data.is_daily,
        is_disabled=False,
        disabled_date=None,
        reminder_time=data.reminder_time
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)

    return TodoResponse(
        id=todo.id,
        user_id=todo.user_id,
        text=todo.text,
        start_date=todo.start_date,
        is_daily=todo.is_daily,
        is_disabled=todo.is_disabled,
        disabled_date=todo.disabled_date,
        reminder_time=todo.reminder_time,
        completed=False,
        created_at=todo.created_at,
        updated_at=todo.updated_at
    )


def toggle_todo_completion(
    db: Session,
    user: User,
    todo_id: uuid.UUID,
    target_date: date,
    explicit_completed: bool | None = None
) -> TodoToggleResponse:
    """
    Toggles or sets the completion state of a task on a specific calendar date.
    Strictly verifies ownership of the todo.
    """
    todo = db.scalars(
        select(Todo).where(
            and_(
                Todo.id == todo_id,
                Todo.user_id == user.id
            )
        )
    ).first()

    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found."
        )

    comp = db.scalars(
        select(TodoCompletion).where(
            and_(
                TodoCompletion.todo_id == todo_id,
                TodoCompletion.user_id == user.id,
                TodoCompletion.date == target_date
            )
        )
    ).first()

    if comp:
        new_status = explicit_completed if explicit_completed is not None else not comp.completed
        comp.completed = new_status
        comp.completed_at = datetime.now(timezone.utc)
    else:
        new_status = explicit_completed if explicit_completed is not None else True
        comp = TodoCompletion(
            todo_id=todo.id,
            user_id=user.id,
            date=target_date,
            completed=new_status,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(comp)

    db.commit()

    return TodoToggleResponse(
        todo_id=todo.id,
        date=target_date,
        completed=new_status,
        message="Task marked completed." if new_status else "Task marked incomplete."
    )


def disable_todo_recurrence(
    db: Session,
    user: User,
    todo_id: uuid.UUID,
    disabled_date: date
) -> TodoResponse:
    """
    Disables future recurrence of a daily todo starting on `disabled_date`.
    Days before `disabled_date` preserve the task and its completion logs.
    From `disabled_date` onwards, the task will no longer recur.
    """
    todo = db.scalars(
        select(Todo).where(
            and_(
                Todo.id == todo_id,
                Todo.user_id == user.id
            )
        )
    ).first()

    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found."
        )

    todo.is_disabled = True
    todo.disabled_date = disabled_date
    db.commit()
    db.refresh(todo)

    return TodoResponse(
        id=todo.id,
        user_id=todo.user_id,
        text=todo.text,
        start_date=todo.start_date,
        is_daily=todo.is_daily,
        is_disabled=todo.is_disabled,
        disabled_date=todo.disabled_date,
        reminder_time=todo.reminder_time,
        completed=False,
        created_at=todo.created_at,
        updated_at=todo.updated_at
    )


def update_todo(
    db: Session,
    user: User,
    todo_id: uuid.UUID,
    data: TodoUpdate
) -> TodoResponse:
    """
    Updates an existing task's description, recurrence, or reminder time.
    Enforces strict user ownership.
    """
    todo = db.scalars(
        select(Todo).where(
            and_(
                Todo.id == todo_id,
                Todo.user_id == user.id
            )
        )
    ).first()

    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found."
        )

    if data.text is not None:
        cleaned_text = data.text.strip()
        if not cleaned_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Task description cannot be empty."
            )
        todo.text = cleaned_text

    if data.is_daily is not None:
        todo.is_daily = data.is_daily

    if data.is_disabled is not None:
        todo.is_disabled = data.is_disabled

    if data.clear_reminder:
        todo.reminder_time = None
    elif data.reminder_time is not None:
        todo.reminder_time = data.reminder_time

    db.commit()
    db.refresh(todo)

    comp = db.scalars(
        select(TodoCompletion).where(
            and_(
                TodoCompletion.todo_id == todo.id,
                TodoCompletion.user_id == user.id,
                TodoCompletion.date == todo.start_date,
                TodoCompletion.completed.is_(True)
            )
        )
    ).first()

    return TodoResponse(
        id=todo.id,
        user_id=todo.user_id,
        text=todo.text,
        start_date=todo.start_date,
        is_daily=todo.is_daily,
        is_disabled=todo.is_disabled,
        disabled_date=todo.disabled_date,
        reminder_time=todo.reminder_time,
        completed=bool(comp),
        created_at=todo.created_at,
        updated_at=todo.updated_at
    )


def delete_todo(db: Session, user: User, todo_id: uuid.UUID) -> None:
    """
    Permanently deletes a task and its completions with strict ownership checking.
    """
    todo = db.scalars(
        select(Todo).where(
            and_(
                Todo.id == todo_id,
                Todo.user_id == user.id
            )
        )
    ).first()

    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found."
        )

    db.delete(todo)
    db.commit()
