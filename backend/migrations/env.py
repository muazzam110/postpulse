from alembic import context
from sqlalchemy import create_engine

import app.models  # noqa: F401  (registers tables on Base.metadata)
from app.core.config import get_settings
from app.db.session import Base

with create_engine(get_settings().database_url).connect() as conn:
    context.configure(connection=conn, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
    conn.commit()
