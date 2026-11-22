from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text

from app.db.session import Base, engine

TABLES = {
    "users", "brand_profiles", "content_items", "knowledge_chunks",
    "feedback", "content_plans", "scheduled_jobs", "post_metrics",
}


def test_all_tables_and_pgvector_exist():
    with engine.connect() as c:
        assert TABLES <= set(inspect(c).get_table_names())
        assert c.execute(text("SELECT 1 FROM pg_extension WHERE extname='vector'")).scalar() == 1
        dim = c.execute(text(
            "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
            "WHERE attrelid='knowledge_chunks'::regclass AND attname='embedding'"
        )).scalar()
        assert dim == "vector(1536)"


def test_vector_index_and_user_scoping():
    insp = inspect(engine)
    assert "ix_knowledge_chunks_embedding" in {i["name"] for i in insp.get_indexes("knowledge_chunks")}
    for table in TABLES - {"users"}:
        fks = {fk["referred_table"] for fk in insp.get_foreign_keys(table)}
        assert "users" in fks, f"{table} must be scoped to a user"


def test_no_column_can_hold_a_provider_key():
    insp = inspect(engine)
    for table in TABLES:
        for col in insp.get_columns(table):
            assert not any(w in col["name"].lower() for w in ("api_key", "openrouter", "secret", "token"))


def test_models_match_migrations():
    with engine.connect() as c:
        diff = compare_metadata(MigrationContext.configure(c, opts={"compare_type": True}), Base.metadata)
    assert diff == []


def test_migration_round_trip(alembic_cfg):
    command.downgrade(alembic_cfg, "base")
    with engine.connect() as c:
        assert not (TABLES & set(inspect(c).get_table_names()))
    command.upgrade(alembic_cfg, "head")
    with engine.connect() as c:
        assert TABLES <= set(inspect(c).get_table_names())
