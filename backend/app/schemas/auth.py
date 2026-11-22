from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, EmailStr, Field, field_validator


def _zone(v: str) -> str:
    try:
        ZoneInfo(v)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise ValueError("is not a timezone we know, e.g. Asia/Kolkata") from None
    return v


Timezone = Annotated[str, Field(max_length=64), AfterValidator(_zone)]


class _Email(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class RegisterIn(_Email):
    password: str = Field(min_length=10, max_length=128)
    timezone: Timezone = "UTC"  # the browser's, so dates are right from the first screen


class LoginIn(_Email):
    password: str = Field(min_length=1, max_length=128)


class MeIn(BaseModel):
    timezone: Timezone


class UserOut(BaseModel):
    id: str
    email: str
    timezone: str
