from fastapi import APIRouter, Depends, HTTPException, Response, status

from app import schemas
from app.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    COOKIE_NAME,
    create_access_token,
    get_current_user,
    verify_password,
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(data: schemas.LoginRequest, response: Response):
    valid = data.username == settings.admin_username and verify_password(
        data.password, settings.admin_password_hash
    )
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=data.username)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"status": "ok"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"status": "ok"}


@router.get("/me")
def me(username: str = Depends(get_current_user)):
    return {"username": username}
