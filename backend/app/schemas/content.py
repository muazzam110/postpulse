"""Request/response models. Every limit here is also enforced for model output, so a misbehaving model can't store junk."""
import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, field_validator

Format = Literal["story", "educational", "lessons", "technical", "framework", "poll", "carousel"]
SourceType = Literal["idea", "notes", "article", "transcript"]
Status = Literal["draft", "approved", "rejected"]  # "scheduled"/"published" are set only by the calendar
ListStatus = Literal["draft", "approved", "rejected", "scheduled", "published"]  # what a listing can filter by


def _clean_tags(v):
    """'#AI Agents', 'ai', '#ai' -> ['#AIAgents', '#ai']: one word each, deduplicated, at most five."""
    if not isinstance(v, list):
        return v
    out: list[str] = []
    for t in v:
        tag = "#" + re.sub(r"\W", "", str(t))[:39]
        if len(tag) > 1 and tag.lower() not in {o.lower() for o in out}:
            out.append(tag)
    return out[:5]


Tags = Annotated[list[str], BeforeValidator(_clean_tags)]


class Claim(BaseModel):
    """A factual statement in a draft. `supported` is computed by the server from `evidence`, never trusted from the model."""

    text: str = Field(min_length=1, max_length=300)
    evidence: str | None = Field(None, max_length=400)
    supported: bool = False


class Post(BaseModel):
    hook: str = Field("", max_length=300)
    body: str = Field("", max_length=3000)
    cta: str = Field("", max_length=300)
    hashtags: Tags = []
    source_claims: list[Claim] = Field(default_factory=list, max_length=12)


class Draft(Post):
    """A generated draft: unlike a hand-made one, it must have a hook and a body."""

    @field_validator("hook", "body")
    @classmethod
    def _required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v.strip()


class ContentIn(Post):
    title: str | None = Field(None, max_length=200)
    source_text: str | None = Field(None, max_length=20000)
    source_type: SourceType = "idea"
    format: Format = "educational"


class ContentPatch(BaseModel):
    title: str | None = Field(None, max_length=200)
    hook: str | None = Field(None, max_length=300)
    body: str | None = Field(None, max_length=3000)
    cta: str | None = Field(None, max_length=300)
    hashtags: Tags | None = None
    format: Format | None = None
    status: Status | None = None
    comment: str | None = Field(None, max_length=500)  # why it was approved or rejected; becomes feedback, not a column


class ScheduleIn(BaseModel):
    content_id: UUID
    scheduled_at: datetime  # must carry a timezone; stored as UTC


class FeedbackIn(BaseModel):
    comment: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class ContentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    source_type: str
    format: str
    hook: str
    body: str
    cta: str
    hashtags: list[str]
    source_claims: list[Claim]
    status: str
    scheduled_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ContentDetail(ContentOut):
    source_text: str | None
    evaluation: dict | None


# --- AI requests / structured model output ---
class SourceIn(BaseModel):
    source_text: str = Field(min_length=20, max_length=20000)
    source_type: SourceType = "idea"
    model: str


class GenerateIn(SourceIn):
    format: Format = "educational"
    goal: str = Field("", max_length=200)
    audience: str = Field("", max_length=300)
    tone: str = Field("", max_length=200)
    length: Literal["short", "medium", "long"] = "medium"
    cta_style: Literal["question", "soft", "direct", "none"] = "question"
    hashtags: bool = True
    angle: str = Field("", max_length=400)
    insights: list[Annotated[str, Field(max_length=500)]] = Field(default_factory=list, max_length=8)
    use_knowledge: bool = True


class EvaluateIn(Draft):
    model: str
    source_text: str | None = Field(None, max_length=20000)
    content_id: UUID | None = None  # a saved draft: its review is stored with it


class Insight(BaseModel):
    kind: Literal["claim", "example", "lesson", "idea"]
    text: str = Field(min_length=1, max_length=300)
    evidence: str | None = Field(None, max_length=400)
    grounded: bool = False  # computed: is `evidence` really in the source?


class Angle(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    hook: str = Field(min_length=1, max_length=300)


class Summary(BaseModel):
    insights: list[Insight] = Field(max_length=10)
    angles: list[Angle] = Field(min_length=1, max_length=3)


# --- brand voice ---
Short = Annotated[str, Field(min_length=1, max_length=60)]


class BrandIn(BaseModel):
    tone: str = Field("", max_length=300)
    audience: str = Field("", max_length=300)
    expertise: str = Field("", max_length=500)
    pillars: list[Short] = Field(default_factory=list, max_length=5)
    avoid: list[Short] = Field(default_factory=list, max_length=20)
    structure: Literal["", "story", "steps", "contrarian", "qa"] = ""
    examples: list[Annotated[str, Field(min_length=1, max_length=3000)]] = Field(default_factory=list, max_length=5)


# --- knowledge base ---
class KnowledgeIn(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=100)]
    text: str = Field(min_length=20, max_length=20000)

    @field_validator("title")
    @classmethod
    def _strip(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v.strip()
