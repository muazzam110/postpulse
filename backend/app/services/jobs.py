"""PostgreSQL-backed job queue. Claims are atomic (FOR UPDATE SKIP LOCKED) and committed before the work starts.

A claim is a lease: a job still "running" after the lock timeout belongs to a worker that died, and is picked up again.
`attempts` doubles as a fencing token, so a worker that was presumed dead can't overwrite what the new owner decided.
Jobs hold no credentials. The only job today is a reminder: nothing is ever posted to LinkedIn on the user's behalf.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import redact
from app.models import ContentItem, ScheduledJob, WorkerHeartbeat

LIVE = ("queued", "running")
BACKOFF_SECONDS = 60  # doubles with every failed attempt
WORKER = "main"


class Permanent(Exception):
    """A failure that retrying cannot fix."""


def now() -> datetime:
    return datetime.now(timezone.utc)


def cancel_live(db: Session, item_id) -> int:
    return db.query(ScheduledJob).filter(ScheduledJob.content_item_id == item_id, ScheduledJob.status.in_(LIVE)).update({"status": "cancelled", "locked_at": None}, synchronize_session=False)


def enqueue(db: Session, item: ContentItem, run_at: datetime, job_type: str = "reminder") -> ScheduledJob:
    cancel_live(db, item.id)  # executes now, so the one-live-job index is satisfied
    job = ScheduledJob(user_id=item.user_id, content_item_id=item.id, job_type=job_type, run_at=run_at, max_attempts=get_settings().worker_max_attempts)
    db.add(job)
    db.flush()
    return job


def claim(db: Session, at: datetime | None = None) -> ScheduledJob | None:
    at = at or now()
    stale = at - timedelta(seconds=get_settings().worker_lock_timeout_seconds)
    while True:
        job = db.execute(
            select(ScheduledJob)
            .where(or_(and_(ScheduledJob.status == "queued", ScheduledJob.run_at <= at), and_(ScheduledJob.status == "running", ScheduledJob.locked_at < stale)))
            .order_by(ScheduledJob.run_at).limit(1).with_for_update(skip_locked=True)
        ).scalar_one_or_none()
        if job is None:
            return None
        if job.attempts >= job.max_attempts:  # the workers that held it kept dying: stop, don't loop forever
            job.status, job.locked_at, job.last_error = "failed", None, "The worker stopped while running this job too many times."
            db.commit()
            continue
        job.status, job.locked_at, job.attempts = "running", at, job.attempts + 1
        db.commit()
        return job


def reminder(db: Session, job: ScheduledJob) -> str:
    item = db.get(ContentItem, job.content_item_id) if job.content_item_id else None
    return "notified" if item and item.status == "scheduled" and item.scheduled_at else "skipped"


HANDLERS = {"reminder": reminder}


def _settle(db: Session, job: ScheduledJob, token: int, **values) -> bool:
    """Record the result only if this worker still owns the job."""
    n = db.query(ScheduledJob).filter_by(id=job.id, status="running", attempts=token).update({**values, "locked_at": None}, synchronize_session=False)
    db.commit()
    return bool(n)


def execute(db: Session, job: ScheduledJob) -> str:
    token, payload = job.attempts, dict(job.payload or {})
    try:
        handler = HANDLERS.get(job.job_type)
        if handler is None:
            raise Permanent(f"Unknown job type {job.job_type!r}.")
        outcome = handler(db, job)
        _settle(db, job, token, status="succeeded", payload={**payload, "outcome": outcome}, last_error=None)
        return "succeeded"
    except Exception as exc:  # noqa: BLE001 - a job failing must never take the worker down
        db.rollback()
        error = redact(f"{type(exc).__name__}: {exc}")[:300]  # never the raw provider or database text
        if isinstance(exc, Permanent) or token >= job.max_attempts:
            _settle(db, job, token, status="failed", last_error=error)
            return "failed"
        _settle(db, job, token, status="queued", run_at=now() + timedelta(seconds=BACKOFF_SECONDS * 2 ** (token - 1)), last_error=error)
        return "retrying"


def beat(db: Session) -> None:
    stmt = insert(WorkerHeartbeat).values(name=WORKER, seen_at=now())
    db.execute(stmt.on_conflict_do_update(index_elements=["name"], set_={"seen_at": stmt.excluded.seen_at}))
    db.commit()


def worker_seen(db: Session) -> datetime | None:
    return db.query(func.max(WorkerHeartbeat.seen_at)).scalar()
