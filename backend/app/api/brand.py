from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import current_user
from app.db.session import get_db
from app.models import BrandProfile, User
from app.schemas.content import BrandIn

router = APIRouter(prefix="/brand")


def load_voice(db: Session, user: User) -> dict:
    """The user's brand voice in API shape (empty defaults if they haven't set one up)."""
    p = db.query(BrandProfile).filter_by(user_id=user.id).one_or_none()
    s = p.style_preferences if p else {}
    return {
        "tone": p.tone or "" if p else "", "audience": p.audience or "" if p else "", "expertise": p.expertise or "" if p else "",
        "pillars": s.get("pillars", []), "avoid": s.get("avoid", []), "structure": s.get("structure", ""), "examples": s.get("examples", []),
    }


@router.get("")
def read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return load_voice(db, user)


@router.put("")
def save(body: BrandIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.query(BrandProfile).filter_by(user_id=user.id).one_or_none() or BrandProfile(user_id=user.id)
    p.tone, p.audience, p.expertise = body.tone, body.audience, body.expertise
    p.style_preferences = body.model_dump(include={"pillars", "avoid", "structure", "examples"})
    db.add(p)
    db.commit()
    return load_voice(db, user)
