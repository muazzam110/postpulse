from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/health")


@router.get("")
def liveness():
    return {"status": "ok"}


@router.get("/db")
def database(db: Session = Depends(get_db)):
    """Readiness: database reachable and pgvector installed. Failure detail is never returned."""
    try:
        version = db.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).scalar()
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable.")
    if not version:
        raise HTTPException(503, "pgvector extension is not installed.")
    return {"status": "ok", "pgvector": version}
