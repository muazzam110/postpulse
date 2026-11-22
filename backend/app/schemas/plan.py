"""Weekly content plans: what the user sends, what the model must return, and what is stored."""
import uuid
from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.schemas.content import Format, Short


class PlanPost(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12], max_length=32)
    day: int = Field(ge=0, le=6)  # 0 = Monday
    pillar: str = Field("", max_length=60)
    format: Format = "educational"
    title: str = Field(min_length=1, max_length=120)
    angle: str = Field("", max_length=400)
    time: str = Field("09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")  # the user's local time

    @field_validator("title")
    @classmethod
    def _strip(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v.strip()


class PlanIn(BaseModel):
    goal: str = Field(min_length=3, max_length=200)
    pillars: list[Short] = Field(default_factory=list, max_length=5)  # empty = use the brand voice's
    audience: str = Field("", max_length=300)
    per_week: int = Field(3, ge=1, le=5)
    week_start: date
    use_knowledge: bool = True
    model: str

    @field_validator("week_start")
    @classmethod
    def _monday(cls, v: date) -> date:
        if v.weekday() != 0:
            raise ValueError("must be a Monday")
        return v


class PlanPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    posts: list[PlanPost] | None = Field(None, max_length=14)


class ModelPlan(BaseModel):
    posts: list[PlanPost] = Field(min_length=1, max_length=14)
