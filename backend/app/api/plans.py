from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.brand import load_voice
from app.core.errors import AppError
from app.core.security import current_user, openrouter_key
from app.db.session import get_db
from app.models import ContentItem, ContentPlan, User
from app.schemas.plan import PlanIn, PlanPatch
from app.services import knowledge, openrouter, planner

router = APIRouter(prefix="/plans", dependencies=[Depends(current_user)])  # login is checked before anything else, including the key
MAX_PLANS = 200


def owned(db: Session, user: User, plan_id: UUID) -> ContentPlan:
    plan = db.query(ContentPlan).filter_by(id=plan_id, user_id=user.id).one_or_none()
    if plan is None:
        raise AppError(404, "not_found", "That plan doesn't exist.")
    return plan


def out(plan: ContentPlan) -> dict:
    return {"id": str(plan.id), "title": plan.title, "created_at": plan.created_at, **plan.plan_data}


@router.post("", status_code=201)
def create(body: PlanIn, key: str = Depends(openrouter_key), user: User = Depends(current_user), db: Session = Depends(get_db)):
    openrouter.require_supported(body.model)
    if db.query(ContentPlan).filter_by(user_id=user.id).count() >= MAX_PLANS:
        raise AppError(422, "plans_full", "You have a lot of plans. Delete some you no longer need first.")
    voice = load_voice(db, user)
    titles = [t for (t,) in db.query(ContentItem.title).filter(ContentItem.user_id == user.id, ContentItem.status != "rejected").order_by(ContentItem.updated_at.desc()).limit(15)]
    topic = " ".join([body.goal, *(body.pillars or voice["pillars"])])
    notes = knowledge.retrieve(db, user, key, topic) if body.use_knowledge else []
    posts = planner.generate(key, body, voice, titles, notes)
    plan = ContentPlan(user_id=user.id, title=f"Week of {body.week_start:%b} {body.week_start.day}", plan_data={
        "week_start": body.week_start.isoformat(), "goal": body.goal, "per_week": body.per_week,
        "posts": [p.model_dump() for p in posts], "context": sorted({n["title"] for n in notes}),
    })
    db.add(plan)
    db.commit()
    return out(plan)


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(ContentPlan).filter_by(user_id=user.id).order_by(ContentPlan.created_at.desc()).limit(30).all()
    return [{"id": str(r.id), "title": r.title, "week_start": r.plan_data.get("week_start"), "goal": r.plan_data.get("goal"), "count": len(r.plan_data.get("posts", [])), "created_at": r.created_at} for r in rows]


@router.get("/{plan_id}")
def read(plan_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return out(owned(db, user, plan_id))


@router.patch("/{plan_id}")
def update(plan_id: UUID, body: PlanPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    plan = owned(db, user, plan_id)
    if body.title is not None:
        plan.title = body.title
    if body.posts is not None:
        plan.plan_data = {**plan.plan_data, "posts": [p.model_dump() for p in body.posts]}  # reassigned, so the change is detected
    db.commit()
    return out(plan)


@router.delete("/{plan_id}", status_code=204)
def delete(plan_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, user, plan_id))
    db.commit()
    return Response(status_code=204)
