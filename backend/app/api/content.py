from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import current_user
from app.db.session import get_db
from app.models import ContentItem, Feedback, User
from app.services import jobs
from app.services.source import clean, grounded
from app.schemas.content import ContentDetail, ContentIn, ContentOut, ContentPatch, FeedbackIn, ListStatus

router = APIRouter(prefix="/content")


def owned(db: Session, user: User, item_id: UUID) -> ContentItem:
    """Someone else's item and a missing one are indistinguishable: both are a plain 404."""
    item = db.query(ContentItem).filter_by(id=item_id, user_id=user.id).one_or_none()
    if item is None:
        raise AppError(404, "not_found", "That draft doesn't exist.")
    return item


def lessons(db: Session, user: User, n: int = 5) -> list[str]:
    """Reasons the user gave for rejecting recent drafts. They are fed back into generation so the same mistake isn't repeated."""
    rows = db.query(Feedback.comment).filter(Feedback.user_id == user.id, Feedback.action == "rejected", Feedback.comment.is_not(None)).order_by(Feedback.created_at.desc()).limit(n).all()
    return [c for (c,) in rows if c.strip()]


@router.post("", status_code=201, response_model=ContentDetail)
def create(body: ContentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    text = clean(body.source_text, body.source_type)[0] if body.source_text else ""
    for claim in body.source_claims:  # support is recomputed here: a client-supplied flag is never believed
        claim.supported = grounded(claim.evidence, text)
    fields = {**body.model_dump(exclude={"title"}), "source_text": text or None}  # store what the claims were checked against
    item = ContentItem(user_id=user.id, title=body.title or body.hook[:80].strip() or "Untitled draft", **fields)
    db.add(item)
    db.commit()
    return item


@router.get("", response_model=list[ContentOut])
def listing(status: ListStatus | None = Query(None), user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(ContentItem).filter_by(user_id=user.id)
    if status:
        q = q.filter_by(status=status)
    return q.order_by(ContentItem.updated_at.desc()).limit(200).all()


@router.get("/{item_id}", response_model=ContentDetail)
def read(item_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return owned(db, user, item_id)


@router.patch("/{item_id}", response_model=ContentDetail)
def update(item_id: UUID, body: ContentPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(db, user, item_id)
    changes = body.model_dump(exclude_none=True, exclude={"comment"})
    if body.status and item.status == "published":
        raise AppError(409, "published", "That post is already published, so its status can't change.")
    if body.status and body.status != item.status and item.status == "scheduled":
        jobs.cancel_live(db, item.id)  # leaving 'scheduled' by any route cancels the reminder
        item.scheduled_at = None
    if body.status in ("approved", "rejected") and body.status != item.status:
        db.add(Feedback(user_id=user.id, content_item_id=item.id, action=body.status, comment=(body.comment or "").strip() or None))
    if changes.keys() & {"hook", "body", "cta", "hashtags"}:
        item.evaluation = None  # a review of the old text no longer describes this one
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return item


@router.post("/{item_id}/feedback", status_code=201)
def add_feedback(item_id: UUID, body: FeedbackIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned(db, user, item_id)
    db.add(Feedback(user_id=user.id, content_item_id=item.id, action="note", comment=body.comment))
    db.commit()
    return Response(status_code=201)


@router.get("/{item_id}/feedback")
def feedback(item_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Feedback).filter_by(content_item_id=owned(db, user, item_id).id).order_by(Feedback.created_at.desc()).limit(50).all()
    return [{"action": f.action, "comment": f.comment, "created_at": f.created_at} for f in rows]


@router.delete("/{item_id}", status_code=204)
def delete(item_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, user, item_id))
    db.commit()
    return Response(status_code=204)
