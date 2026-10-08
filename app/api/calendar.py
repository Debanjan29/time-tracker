from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.calendar import MonthCalendarResponse
from app.services.calendar import get_month_calendar
from app.api.deps import get_current_user

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("/month/{year}/{month}", response_model=MonthCalendarResponse, summary="Get monthly calendar indicators")
def get_month(
    year: int = Path(ge=2000, le=2100, description="Year (e.g. 2026)"),
    month: int = Path(ge=1, le=12, description="Month (1-12)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns days of the month with summary indicators (has entries, has notes, daily total)
    calculated for the user's timezone.
    """
    return get_month_calendar(db, current_user, year, month)
