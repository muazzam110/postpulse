from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.brand import load_voice
from app.api.content import lessons, owned
from app.core.security import current_user, openrouter_key
from app.db.session import get_db
from app.models import User
from app.schemas.content import EvaluateIn, GenerateIn, SourceIn
from app.services import evaluate, generate, knowledge, openrouter, source

router = APIRouter(prefix="/ai", dependencies=[Depends(current_user)])


@router.post("/validate-key")
def validate_key(key: str = Depends(openrouter_key)):
    return openrouter.validate_key(key)


@router.get("/models")
def models():
    return openrouter.MODELS


@router.post("/summarize")
def summarize(body: SourceIn, key: str = Depends(openrouter_key)):
    openrouter.require_supported(body.model)
    text, removed = source.clean(body.source_text, body.source_type)
    result = generate.summarize(key, body.model, text, body.source_type)
    return {"removed_timestamps": removed, **result.model_dump()}


@router.post("/generate")
def generate_drafts(body: GenerateIn, key: str = Depends(openrouter_key), user: User = Depends(current_user), db: Session = Depends(get_db)):
    openrouter.require_supported(body.model)
    text, removed = source.clean(body.source_text, body.source_type)
    voice = load_voice(db, user)
    notes = knowledge.retrieve(db, user, key, " ".join([body.angle, *body.insights, text[:1500]])) if body.use_knowledge else []
    found = generate.drafts(key, body, text, voice, notes, lessons(db, user))
    return {
        "removed_timestamps": removed,
        "drafts": [{**d.model_dump(), **evaluate.checks(db, user, d.model_dump(), voice)} for d in found],
        "context": [{"id": n["id"], "title": n["title"], "snippet": n["text"][:160]} for n in notes],
    }


@router.post("/evaluate")
def evaluate_draft(body: EvaluateIn, key: str = Depends(openrouter_key), user: User = Depends(current_user), db: Session = Depends(get_db)):
    openrouter.require_supported(body.model)
    item = owned(db, user, body.content_id) if body.content_id else None
    post, voice = body.model_dump(include={"hook", "body", "cta", "hashtags"}), load_voice(db, user)
    result = {**evaluate.score(key, body.model, post, voice, body.source_text or (item and item.source_text)), **evaluate.checks(db, user, post, voice, item and item.id)}
    result["unsupported_claims"] = sum(not c.supported for c in body.source_claims)
    saved = {"hook": item.hook, "body": item.body, "cta": item.cta, "hashtags": item.hashtags} if item else None
    if saved and {k: v.strip() if isinstance(v, str) else v for k, v in saved.items()} == post:  # only if this is what is saved (the request is already stripped)
        item.evaluation = result
        db.commit()
    return result
