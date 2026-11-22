from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.security import current_user, openrouter_key, optional_openrouter_key
from app.db.session import get_db
from app.models import User
from app.schemas.content import KnowledgeIn
from app.services import knowledge
from app.services.source import clean

router = APIRouter(prefix="/knowledge")


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return knowledge.documents(db, user)


@router.post("", status_code=201)
def add(body: KnowledgeIn, user: User = Depends(current_user), db: Session = Depends(get_db), key: str | None = Depends(optional_openrouter_key)):
    return knowledge.add_document(db, user, key, body.title, clean(body.text, "notes")[0])


@router.delete("/{doc_id}", status_code=204)
def delete(doc_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    knowledge.remove(db, user, doc_id)
    return Response(status_code=204)


@router.post("/reindex")
def reindex(user: User = Depends(current_user), db: Session = Depends(get_db), key: str = Depends(openrouter_key)):
    return knowledge.reindex(db, user, key)


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=500), user: User = Depends(current_user), db: Session = Depends(get_db), key: str | None = Depends(optional_openrouter_key)):
    return [{**h, "text": h["text"][:300]} for h in knowledge.retrieve(db, user, key, q)]
