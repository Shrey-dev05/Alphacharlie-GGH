"""
Authentication + Role-Based Access Control (RBAC).

Four roles map directly to the personas in the spec:
  - field_inspector     : capture/upload, run scans, issue legal notices
  - ecommerce_auditor    : bulk-scan online listings
  - manufacturer         : pre-print QA on packaging designs
  - super_admin          : nationwide/statewide analytics dashboard
"""
from datetime import datetime, timedelta, timezone
from enum import Enum

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


class Role(str, Enum):
    FIELD_INSPECTOR = "field_inspector"
    ECOMMERCE_AUDITOR = "ecommerce_auditor"
    MANUFACTURER = "manufacturer"
    SUPER_ADMIN = "super_admin"


def hash_password(password: str) -> str:
    # bcrypt has a hard 72-byte input limit; truncate defensively rather
    # than raising on unusually long passphrases.
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pw_bytes = plain.encode("utf-8")[:72]
    return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))


def create_access_token(subject: str, role: str, extra: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


class TokenData:
    def __init__(self, username: str, role: str):
        self.username = username
        self.role = role


def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        return TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception


oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)


def get_optional_current_user(token: str | None = Depends(oauth2_optional_scheme)) -> TokenData | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username and role:
            return TokenData(username=username, role=role)
    except JWTError:
        pass
    return None


def require_roles(*allowed: Role):
    """FastAPI dependency factory for RBAC-gated endpoints.

    Usage: `Depends(require_roles(Role.SUPER_ADMIN))`
    """

    def _check(user: TokenData = Depends(get_current_user)) -> TokenData:
        if user.role not in {r.value for r in allowed}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted to perform this action.",
            )
        return user

    return _check
