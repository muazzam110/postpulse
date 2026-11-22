from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.content import owned
from app.core.errors import AppError
from app.core.security import current_user
from app.db.session import get_db
from app.models import ContentItem, ScheduledJob, User
from app.schemas.content import ScheduleIn
from app.services import jobs

router = APIRouter(prefix="/calendar")
job_router = APIRouter(prefix="/jobs")
HORIZON = timedelta(days=366)
TAKEN = AppError(409, "slot_taken", "This time slot already has a post.")


def job_out(j: ScheduledJob | None) -> dict | None:
    if j is None:
        return None
    return {"id": str(j.id), "type": j.job_type, "status": j.status, "attempts": j.attempts, "max_attempts": j.max_attempts, "run_at": j.run_at, "last_error": j.last_error, "updated_at": j.updated_at}


def entry(item: ContentItem, job: ScheduledJob | None) -> dict:
    return {"id": str(item.id), "title": item.title, "format": item.format, "status": item.status, "scheduled_at": item.scheduled_at, "published_at": item.published_at, "job": job_out(job)}


def latest_job(db: Session, item_id) -> ScheduledJob | None:
    return db.query(ScheduledJob).filter_by(content_item_id=item_id).order_by(ScheduledJob.created_at.desc()).first()


@router.get("")
def listing(start: datetime | None = Query(None), end: datetime | None = Query(None), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Scheduled and published posts, newest slot first, each with its latest job. Times are UTC; the browser shows them in the user's zone."""
    q = db.query(ContentItem).filter(ContentItem.user_id == user.id, ContentItem.scheduled_at.is_not(None), ContentItem.status.in_(("scheduled", "published")))
    if start:
        q = q.filter(ContentItem.scheduled_at >= start)
    if end:
        q = q.filter(ContentItem.scheduled_at < end)
    items = q.order_by(ContentItem.scheduled_at).limit(500).all()
    latest: dict = {}
    for j in db.query(ScheduledJob).filter(ScheduledJob.content_item_id.in_([i.id for i in items])).order_by(ScheduledJob.created_at):
        latest[j.content_item_id] = j  # ascending, so the last one wins
    return {"items": [entry(i, latest.get(i.id)) for i in items], "worker_seen_at": jobs.worker_seen(db)}


@router.post("", status_code=201)
def schedule(body: ScheduleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(db, user, body.content_id)
    if item.status not in ("approved", "scheduled"):
        raise AppError(409, "not_approved", "Approve this draft before scheduling it.")
    now, at = jobs.now(), body.scheduled_at
    if at.tzinfo is None:
        raise AppError(422, "invalid_time", "Send the time together with its timezone.")
    if at <= now or at > now + HORIZON:
        raise AppError(422, "invalid_time", "Pick a time in the future, within a year." if at > now else "Pick a time in the future.")
    at = at.astimezone(timezone.utc).replace(second=0, microsecond=0)  # slots are whole minutes
    if db.query(ContentItem.id).filter(ContentItem.user_id == user.id, ContentItem.status == "scheduled", ContentItem.scheduled_at == at, ContentItem.id != item.id).first():
        raise TAKEN
    item.status, item.scheduled_at = "scheduled", at
    try:
        job = jobs.enqueue(db, item, at)
        db.commit()
    except IntegrityError:  # two requests raced for the same slot
        db.rollback()
        raise TAKEN from None
    return entry(item, job)


def scheduled(db: Session, user: User, item_id: UUID) -> ContentItem:
    item = owned(db, user, item_id)
    if item.status != "scheduled":
        raise AppError(404, "not_scheduled", "That post isn't scheduled.")
    return item


@router.delete("/{item_id}", status_code=204)
def cancel(item_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = scheduled(db, user, item_id)
    jobs.cancel_live(db, item.id)
    item.status, item.scheduled_at = "approved", None
    db.commit()
    return Response(status_code=204)


@router.post("/{item_id}/published")
def mark_published(item_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """The user posted it themselves; nothing here posts to LinkedIn."""
    item = scheduled(db, user, item_id)
    jobs.cancel_live(db, item.id)
    item.status, item.published_at = "published", jobs.now()
    db.commit()
    return entry(item, latest_job(db, item.id))


@job_router.get("/{job_id}")
def job(job_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    found = db.query(ScheduledJob).filter_by(id=job_id, user_id=user.id).one_or_none()
    if found is None:
        raise AppError(404, "not_found", "That job doesn't exist.")
    return {**job_out(found), "content_id": str(found.content_item_id) if found.content_item_id else None}
