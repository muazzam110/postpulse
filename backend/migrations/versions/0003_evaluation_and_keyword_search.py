"""saved quality evaluation, keyword search index for the knowledge base"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
revision = '0003'
down_revision = '0002'


def upgrade():
    op.add_column('content_items', sa.Column('evaluation', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index('ix_knowledge_chunks_fts', 'knowledge_chunks', [sa.text("to_tsvector('english', text)")], postgresql_using='gin')


def downgrade():
    op.drop_index('ix_knowledge_chunks_fts', table_name='knowledge_chunks')
    op.drop_column('content_items', 'evaluation')
