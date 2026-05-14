from __future__ import annotations

import base64
import secrets
from datetime import datetime, timedelta
from io import BytesIO
from typing import Dict, Optional

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

try:
    import pyotp
except ImportError:  # pragma: no cover - depends on the local runtime
    pyotp = None

try:
    import qrcode
except ImportError:  # pragma: no cover - depends on the local runtime
    qrcode = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh", "jti": secrets.token_hex(12)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def _require_two_factor_dependencies() -> None:
    if pyotp is None or qrcode is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Two-factor authentication dependencies are not installed. Install pyotp and qrcode.",
        )


def generate_totp_secret() -> str:
    _require_two_factor_dependencies()
    return pyotp.random_base32()


def generate_qr_code(secret: str, user_email: str) -> str:
    _require_two_factor_dependencies()
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user_email, issuer_name="5*A")
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"


def verify_totp_code(secret: str, code: str) -> bool:
    _require_two_factor_dependencies()
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def generate_backup_codes(count: int = 8) -> list[str]:
    return [secrets.token_hex(4).upper() for _ in range(count)]


async def verify_google_oauth_code(code: str, redirect_uri: str) -> dict:
    """Verify Google OAuth code and fetch user profile info."""
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth code")

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        # Fetch actual user profile from Google userinfo endpoint
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch user profile")

        user_info = userinfo_response.json()
        # Merge token data with actual user profile
        return {
            **token_data,
            "email": user_info.get("email"),
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", ""),
            "email_verified": user_info.get("email_verified", False),
        }
