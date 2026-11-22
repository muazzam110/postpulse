from app.models import KnowledgeChunk, User

DIM = 1536


def unit(i):
    return [1.0 if j == i else 0.0 for j in range(DIM)]


def test_cosine_retrieval_is_scoped_to_the_user_and_skips_unindexed_chunks(db):
    a, b = (User(email=f"{n}@example.com", password_hash="x") for n in "ab")
    db.add_all([a, b])
    db.flush()
    db.add_all([
        KnowledgeChunk(user_id=a.id, text="mine-near", embedding=unit(0)),
        KnowledgeChunk(user_id=a.id, text="mine-far", embedding=unit(5)),
        KnowledgeChunk(user_id=b.id, text="theirs-nearest", embedding=unit(0)),
        KnowledgeChunk(user_id=a.id, text="not-indexed"),
    ])
    db.flush()
    rows = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.user_id == a.id, KnowledgeChunk.embedding.is_not(None))
        .order_by(KnowledgeChunk.embedding.cosine_distance(unit(0)))
        .all()
    )
    assert [r.text for r in rows] == ["mine-near", "mine-far"]
