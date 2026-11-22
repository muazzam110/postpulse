"""Sanitized API errors: no stack traces, no echoed request input, no provider internals (F13)."""
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.errors")


class AppError(Exception):
    """Expected, user-safe failure with a stable machine code the UI can branch on."""

    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def error_response(status: int, code: str, message: str, **extra) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message, **extra}}, status_code=status)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return error_response(exc.status, exc.code, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        res = error_response(exc.status_code, "http_error", message)
        res.headers.update(exc.headers or {})
        return res

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        # Report field names and messages only. Never echo `input`: it may contain secrets.
        fields = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return error_response(422, "validation_error", "Some fields are invalid.", fields=fields)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        ref = uuid.uuid4().hex[:10]
        log.error("unhandled %s ref=%s", type(exc).__name__, ref, exc_info=exc)
        return error_response(500, "internal_error", "Something went wrong on our side.", ref=ref)
