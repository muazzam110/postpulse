import time
from collections import defaultdict

from fastapi import APIRouter, Depends, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import DUMMY_HASH, current_user, end_session, hash_password, start_session, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.auth import LoginIn, MeIn, RegisterIn, UserOut

router = APIRouter(prefix="/auth")

# Per-process failed-login throttle (5 per 15 min per email). Behind several workers, move this to the database.
MAX_FAILURES, WINDOW = 5, 15 * 60
_failures: dict[str, list[float]] = defaultdict(list)


def _out(user: User) -> UserOut:
    return UserOut(id=str(user.id), email=user.email, timezone=user.timezone)


@router.post("/register", status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    user = User(email=body.email, password_hash=hash_password(body.password), timezone=body.timezone)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "email_taken", "An account with this email already exists. Try logging in.")
    start_session(response, user)
    return _out(user)


@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    now = time.monotonic()
    recent = _failures[body.email] = [t for t in _failures[body.email] if now - t < WINDOW]
    if len(recent) >= MAX_FAILURES:
        wait = int((WINDOW - (now - recent[0])) // 60) + 1
        raise AppError(429, "too_many_attempts", f"Too many failed attempts. Try again in {wait} minute{'s' if wait > 1 else ''}.")
    user = db.query(User).filter(User.email == body.email).one_or_none()
    if not verify_password(body.password, user.password_hash if user else DUMMY_HASH) or user is None:
        recent.append(now)
        raise AppError(401, "invalid_credentials", "Email or password is incorrect.")
    _failures.pop(body.email, None)
    start_session(response, user)
    return _out(user)


@router.post("/logout", status_code=204)
def logout(response: Response):
    end_session(response)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _out(user)


@router.patch("/me")
def update_me(body: MeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.timezone = body.timezone
    db.commit()
    return _out(user)
