"""The user's knowledge base: chunking, embeddings, and retrieval that is always scoped to one user.

Semantic search needs an embedding, which needs the user's key. Without one (or if the provider fails) chunks are still
stored and found by keyword, so a provider outage never loses notes or blocks drafting.
"""
import re
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import KnowledgeChunk, User
from app.services import openrouter

CHUNK, OVERLAP = 900, 120
MAX_CHUNKS = 1000  # per user
MAX_DISTANCE = 0.65  # cosine distance above which a chunk is considered unrelated (tune with real data)
BATCH = 64


def chunk(text: str, size: int = CHUNK, overlap: int = OVERLAP) -> list[str]:
    """Paragraph-aware pieces of at most `size` characters; a paragraph longer than that is cut at a space with some overlap."""
    out, cur = [], ""
    for para in (p.strip() for p in re.split(r"\n\s*\n", text.strip())):
        while len(para) > size:
            cut = para.rfind(" ", size // 2, size)
            cut = cut if cut > 0 else size
            if cur:
                out.append(cur)
                cur = ""
            out.append(para[:cut])
            para = para[cut - overlap:].lstrip()
        if cur and len(cur) + len(para) + 2 > size:
            out.append(cur)
            cur = ""
        cur = f"{cur}\n\n{para}" if cur else para
    return [c for c in [*out, cur] if c.strip()]


def embed(key: str, texts: list[str]) -> list[list[float]]:
    """One vector per text, or a safe AppError. The provider's answer is checked, never trusted."""
    s = get_settings()
    res = openrouter.call(key, "POST", "/embeddings", timeout=60, json={"model": s.embedding_model, "input": texts})
    try:
        vectors = [r["embedding"] for r in sorted(res.json()["data"], key=lambda r: r["index"])]
        ok = len(vectors) == len(texts) and all(isinstance(v, list) and len(v) == s.embedding_dim and all(isinstance(x, (int, float)) for x in v) for v in vectors)
    except (KeyError, TypeError, ValueError):
        ok = False
    if not ok:
        raise AppError(502, "embedding_failed", "The embedding service returned something we couldn't use.")
    return vectors


def add_document(db: Session, user: User, key: str | None, title: str, text: str) -> dict:
    parts = chunk(text)
    if db.query(func.count(KnowledgeChunk.id)).filter_by(user_id=user.id).scalar() + len(parts) > MAX_CHUNKS:
        raise AppError(422, "knowledge_full", "Your knowledge base is full. Delete something you no longer need first.")
    vectors, warning = [None] * len(parts), None
    if key:
        try:
            vectors = embed(key, parts)
        except AppError as e:  # keep the notes; they stay searchable by keyword
            warning = e.message
    doc, model = str(uuid.uuid4()), get_settings().embedding_model
    db.add_all(
        KnowledgeChunk(user_id=user.id, text=p, embedding=v, embedding_model=model if v else None, meta={"doc": doc, "title": title, "position": i})
        for i, (p, v) in enumerate(zip(parts, vectors))
    )
    db.commit()
    return {"id": doc, "title": title, "chunks": len(parts), "indexed": vectors[0] is not None, "warning": warning}


def documents(db: Session, user: User) -> list[dict]:
    doc = KnowledgeChunk.meta["doc"].astext
    rows = (
        db.query(doc, func.min(KnowledgeChunk.meta["title"].astext), func.count(), func.count(KnowledgeChunk.embedding), func.min(KnowledgeChunk.created_at))
        .filter(KnowledgeChunk.user_id == user.id, doc.is_not(None))
        .group_by(doc)
        .order_by(func.min(KnowledgeChunk.created_at).desc())
        .all()
    )
    return [{"id": d, "title": t, "chunks": n, "indexed": n == ix, "created_at": at} for d, t, n, ix, at in rows]


def remove(db: Session, user: User, doc: str) -> None:
    n = db.query(KnowledgeChunk).filter(KnowledgeChunk.user_id == user.id, KnowledgeChunk.meta["doc"].astext == doc).delete(synchronize_session=False)
    if not n:
        raise AppError(404, "not_found", "That note doesn't exist.")
    db.commit()


def reindex(db: Session, user: User, key: str, limit: int = 200) -> dict:
    """Embed chunks that were saved without a vector. Each batch is committed, so a failure keeps the progress made."""
    rows = db.query(KnowledgeChunk).filter(KnowledgeChunk.user_id == user.id, KnowledgeChunk.embedding.is_(None)).order_by(KnowledgeChunk.created_at).limit(limit).all()
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        for row, vector in zip(batch, embed(key, [r.text for r in batch])):
            row.embedding, row.embedding_model = vector, get_settings().embedding_model
        db.commit()
    left = db.query(func.count(KnowledgeChunk.id)).filter(KnowledgeChunk.user_id == user.id, KnowledgeChunk.embedding.is_(None)).scalar()
    return {"indexed": len(rows), "remaining": left}


def _hit(row: KnowledgeChunk, score: float | None) -> dict:
    return {"id": str(row.id), "title": row.meta.get("title", ""), "text": row.text, "score": score}


def _words(query: str, limit: int = 15) -> list[str]:
    return list(dict.fromkeys(w for w in re.findall(r"\w{4,}", query.casefold())))[:limit]


def retrieve(db: Session, user: User, key: str | None, query: str, k: int = 4) -> list[dict]:
    """Up to k chunks of THIS user's notes: nearest by meaning when a key is available, topped up by keyword matches."""
    mine = db.query(KnowledgeChunk).filter(KnowledgeChunk.user_id == user.id)
    if not mine.first() or not query.strip():
        return []
    hits: list[dict] = []
    if key:
        try:
            vector = embed(key, [query.strip()[:2000]])[0]
            dist = KnowledgeChunk.embedding.cosine_distance(vector)
            near = mine.filter(KnowledgeChunk.embedding.is_not(None), dist <= MAX_DISTANCE).with_entities(KnowledgeChunk, dist).order_by(dist).limit(k).all()
            hits = [_hit(r, round(1 - d, 3)) for r, d in near]
        except AppError:
            pass  # fall back to keywords
    words = _words(query)
    if len(hits) < k and words:
        vec = func.to_tsvector("english", KnowledgeChunk.text)
        q = func.websearch_to_tsquery("english", " or ".join(words))
        rows = mine.filter(vec.op("@@")(q), KnowledgeChunk.id.not_in([h["id"] for h in hits] or [uuid.UUID(int=0)])).order_by(func.ts_rank(vec, q).desc()).limit(k - len(hits)).all()
        hits += [_hit(r, None) for r in rows]
    return hits
