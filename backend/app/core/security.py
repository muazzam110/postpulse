"""Passwords, signed session cookie, current-user dependency, BYOK header, and log redaction."""
import logging
import re
import traceback
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, Header, Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import get_db
from app.models import User

COOKIE, SESSION_SECONDS = "session", 7 * 24 * 3600
_hasher = PasswordHasher()
DUMMY_HASH = _hasher.hash("timing-equaliser")  # verified when the email is unknown, so timing doesn't reveal accounts


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt="session")


def start_session(response: Response, user: User) -> None:
    response.set_cookie(
        COOKIE, _signer().dumps(str(user.id)), max_age=SESSION_SECONDS,
        httponly=True, samesite="lax", secure=get_settings().is_production, path="/",
    )


def end_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax", secure=get_settings().is_production)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Every protected route depends on this; handlers then filter by user.id."""
    try:
        user = db.get(User, uuid.UUID(_signer().loads(request.cookies.get(COOKIE, ""), max_age=SESSION_SECONDS)))
    except (BadSignature, ValueError):
        user = None
    if user is None:
        raise AppError(401, "unauthenticated", "Please log in to continue.")
    return user


KEY_SHAPE = re.compile(r"[\w.\-]{16,256}")


def openrouter_key(x_openrouter_key: str | None = Header(None)) -> str:
    """The caller's own OpenRouter key from a dedicated header. There is deliberately no server-side fallback."""
    if not x_openrouter_key:
        raise AppError(400, "key_required", "Connect your OpenRouter key to continue.")
    if not KEY_SHAPE.fullmatch(x_openrouter_key):
        raise AppError(400, "invalid_key", "That doesn't look like an OpenRouter key.")
    return x_openrouter_key


def optional_openrouter_key(x_openrouter_key: str | None = Header(None)) -> str | None:
    """For features that work without a key but do better with one."""
    return openrouter_key(x_openrouter_key) if x_openrouter_key else None


# --- log redaction: even if a key reached a log call by mistake, it never reaches a log line ---
SECRET_PATTERN = re.compile(r"(sk-or-[\w\-]+|(?i:bearer)\s+[\w.\-]+|(?i:x-openrouter-key['\"]?\s*[:=]\s*['\"]?)[\w.\-]+)")


def redact(text: str) -> str:
    return SECRET_PATTERN.sub("[redacted]", text)


def install_log_redaction() -> None:
    previous = logging.getLogRecordFactory()

    def factory(*args, **kwargs):
        record = previous(*args, **kwargs)
        record.msg, record.args = redact(record.getMessage()), None
        if record.exc_info and record.exc_info[0]:  # tracebacks quote exception text, which can contain a key
            record.exc_text, record.exc_info = redact("".join(traceback.format_exception(*record.exc_info))).rstrip(), None
        return record

    logging.setLogRecordFactory(factory)
