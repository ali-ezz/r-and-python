from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, constr, field_validator

from app.schemas.user import UserResponse


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    user_id: UUID
    username: str
    email: str
    role: str
    exp: Union[datetime, int]


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    username: str
    password: str


class OAuth2LoginRequest(BaseModel):
    provider: str
    code: str
    redirect_uri: str


class RegisterRequest(BaseModel):
    email: str
    username: constr(min_length=3, max_length=100)
    password: constr(min_length=8)
    confirm_password: str
    full_name: Optional[str] = None
    role: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        import re
        if not re.match(r"^.+@.+$", v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, value: str, info) -> str:
        password = info.data.get("password")
        if password and value != password:
            raise ValueError("Passwords do not match")
        return value


class RegisterResponse(BaseModel):
    user: UserResponse
    token: Token


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_code_url: str
    backup_codes: List[str]


class TwoFactorVerifyRequest(BaseModel):
    code: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: constr(min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def reset_passwords_match(cls, value: str, info) -> str:
        password = info.data.get("new_password")
        if password and value != password:
            raise ValueError("Passwords do not match")
        return value


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: constr(min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def change_passwords_match(cls, value: str, info) -> str:
        password = info.data.get("new_password")
        if password and value != password:
            raise ValueError("Passwords do not match")
        return value


class DeviceResponse(BaseModel):
    id: UUID
    device_name: str
    device_type: str
    last_active: datetime
    is_trusted: bool

    model_config = ConfigDict(from_attributes=True)
