"""Authentication routes."""
from datetime import timedelta

from fastapi import APIRouter, Cookie, Header, HTTPException, Response, status

from app.core.db import get_user_by_id, get_user_by_name
from app.core.security import (
    clear_auth_cookies,
    create_access_token,
    decode_access_token,
    generate_csrf_token,
    get_access_token_expire_minutes,
    require_csrf_token,
    set_auth_cookies,
    verify_password,
)
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    """
    Login endpoint.
    
    Request body:
    - username: str
    - password: str
    - remember_me: bool (optional)
    
    Returns:
    - token_type: str
    - expires_in: int (in seconds)
    """
    # Get user by username
    user = await get_user_by_name(request.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません",
        )
    
    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません",
        )
    
    # Create token
    expire_minutes = get_access_token_expire_minutes(request.remember_me)
    access_token = create_access_token(
        data={"sub": str(user["id"]), "name": user["name"]},
        expires_delta=timedelta(minutes=expire_minutes),
    )

    csrf_token = generate_csrf_token()
    set_auth_cookies(response, access_token, csrf_token, expire_minutes * 60)
    
    return LoginResponse(
        message="login successful",
        token_type="bearer",
        expires_in=expire_minutes * 60,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    csrf_cookie: str | None = Cookie(default=None, alias="csrf_token"),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
):
    """Logout endpoint that clears the auth cookies after CSRF validation."""
    require_csrf_token(csrf_cookie, csrf_header)
    clear_auth_cookies(response)
    return LogoutResponse()


@router.get("/me", response_model=UserResponse)
async def me(access_token: str | None = Cookie(default=None, alias="access_token")):
    """Return the authenticated user from the access-token cookie."""
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(access_token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = await get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        permissions=user.get("permissions"),
    )
