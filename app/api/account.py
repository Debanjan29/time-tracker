from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserResponse, UpdateProfile, ChangePassword
from app.services.auth import update_user_profile, change_user_password, delete_user_account
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/account", tags=["Account"])


@router.get("", response_model=UserResponse, summary="Get account information")
def get_account(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("", response_model=UserResponse, summary="Update account details")
def update_account(
    data: UpdateProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the authenticated user's name or timezone.
    """
    return update_user_profile(db, current_user, data)


@router.post("/change-password", summary="Change account password")
def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates password after verifying the current password.
    """
    change_user_password(db, current_user, data)
    return {"message": "Password changed successfully."}


@router.delete("", status_code=status.HTTP_200_OK, summary="Delete user account")
def delete_account(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes the current user's account and clears session cookie.
    """
    delete_user_account(db, current_user)
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "Account successfully deleted."}
