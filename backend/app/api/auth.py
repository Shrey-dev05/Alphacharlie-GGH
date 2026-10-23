from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import (
    Role,
    TokenData,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.role not in {r.value for r in Role}:
        raise HTTPException(400, f"Invalid role. Must be one of: {[r.value for r in Role]}")

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "An account with this email already exists.")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        organization=payload.organization,
        state=payload.state,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=user.id, role=user.role, extra={"name": user.full_name})
    return Token(access_token=token, role=user.role, full_name=user.full_name)


@router.get("/me", response_model=UserOut)
def me(current: TokenData = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current.username).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user
