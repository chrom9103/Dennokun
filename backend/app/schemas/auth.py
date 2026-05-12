"""Request and response schemas for authentication."""
from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login request payload."""
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class LoginResponse(BaseModel):
    """Login response payload."""
    message: str = "login successful"
    token_type: str = "bearer"
    expires_in: int  # in seconds


class LogoutResponse(BaseModel):
    """Logout response payload."""
    message: str = "logout successful"


class UserResponse(BaseModel):
    """User response payload."""
    id: int
    name: str
    email: str
    permissions: Optional[dict] = None
