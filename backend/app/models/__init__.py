"""All tables. Every user-owned row carries user_id. There is intentionally no column for provider keys."""
import uuid
from datetime import datetime
from typing import Annotated

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import get_settings
from app.db.session import Base

Pk = Annotated[uuid.UUID, mapped_column(primary_key=True, default=uuid.uuid4)]
Owner = Annotated[uuid.UUID, mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)]
Created = Annotated[datetime, mapped_column(server_default=func.now())]
Updated = Annotated[datetime, mapped_column(server_default=func.now(), onupdate=func.now())]
Item = Annotated[uuid.UUID, mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"))]
Empty = text("'{}'::jsonb")


class User(Base):
    __tablename__ = "users"
    id: Mapped[Pk]
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str]
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", server_default="UTC")
    created_at: Mapped[Created]


class BrandProfile(Base):
    __tablename__ = "brand_profiles"
    id: Mapped[Pk]
    user_id: Mapped[Owner] = mapped_column(unique=True)
    tone: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(Text)
    expertise: Mapped[str | None] = mapped_column(Text)
    style_preferences: Mapped[dict] = mapped_column(default=dict, server_default=Empty)
    created_at: Mapped[Created]
    updated_at: Mapped[Updated]


class ContentItem(Base):
    __tablename__ = "content_items"
    __table_args__ = (
        Index("ix_content_user_status", "user_id", "status"),
        Index("uq_content_user_slot", "user_id", "scheduled_at", unique=True, postgresql_where=text("status = 'scheduled'")),  # one post per time slot
    )
    id: Mapped[Pk]
    user_id: Mapped[Owner]
    title: Mapped[str] = mapped_column(String(200))
    source_text: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(String(32), default="idea")
    format: Mapped[str] = mapped_column(String(32), default="educational")
    hook: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[str] = mapped_column(Text, default="")
    cta: Mapped[str] = mapped_column(Text, default="")
    hashtags: Mapped[list] = mapped_column(default=list, server_default=text("'[]'::jsonb"))
    source_claims: Mapped[list] = mapped_column(default=list, server_default=text("'[]'::jsonb"))
    evaluation: Mapped[dict | None]  # last quality review; cleared whenever the text is edited
    status: Mapped[str] = mapped_column(String(16), default="draft")
    scheduled_at: Mapped[datetime | None]
    published_at: Mapped[datetime | None]
    created_at: Mapped[Created]
    updated_at: Mapped[Updated]


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("ix_knowledge_chunks_embedding", "embedding", postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"}),
        Index("ix_knowledge_chunks_fts", text("to_tsvector('english', text)"), postgresql_using="gin"),
    )
    id: Mapped[Pk]
    user_id: Mapped[Owner]
    source_content_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_items.id", ondelete="SET NULL"))
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(get_settings().embedding_dim))  # NULL = not indexed yet
    embedding_model: Mapped[str | None] = mapped_column(String(100))
    meta: Mapped[dict] = mapped_column("metadata", default=dict, server_default=Empty)
    created_at: Mapped[Created]


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[Pk]
    user_id: Mapped[Owner]
    content_item_id: Mapped[Item]
    action: Mapped[str] = mapped_column(String(32))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[Created]


class ContentPlan(Base):
    __tablename__ = "content_plans"
    id: Mapped[Pk]
    user_id: Mapped[Owner]
    title: Mapped[str] = mapped_column(String(200))
    plan_data: Mapped[dict] = mapped_column(default=dict, server_default=Empty)
    created_at: Mapped[Created]


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"
    __table_args__ = (
        Index("ix_jobs_due", "status", "run_at"),
        Index("uq_jobs_one_live_per_item", "content_item_id", unique=True, postgresql_where=text("status IN ('queued', 'running')")),  # a post never has two live jobs
    )
    id: Mapped[Pk]
    user_id: Mapped[Owner]
    content_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"))
    job_type: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(default=dict, server_default=Empty)  # never credentials
    status: Mapped[str] = mapped_column(String(16), default="queued")
    run_at: Mapped[datetime]
    attempts: Mapped[int] = mapped_column(default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(default=3, server_default="3")
    locked_at: Mapped[datetime | None]
    last_error: Mapped[str | None] = mapped_column(Text)  # redacted before write
    created_at: Mapped[Created]
    updated_at: Mapped[Updated]


class PostMetric(Base):
    __tablename__ = "post_metrics"
    id: Mapped[Pk]
    user_id: Mapped[Owner]
    content_item_id: Mapped[Item]
    impressions: Mapped[int | None]
    reactions: Mapped[int | None]
    comments: Mapped[int | None]
    shares: Mapped[int | None]
    source: Mapped[str] = mapped_column(String(16), default="manual")
    recorded_at: Mapped[Created]


class WorkerHeartbeat(Base):
    """The worker writes here every poll, so the app can tell the user whether scheduling is really being served."""
    __tablename__ = "worker_heartbeats"
    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    seen_at: Mapped[datetime]
