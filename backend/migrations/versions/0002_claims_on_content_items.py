"""claims on content items"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
revision = '0002'
down_revision = '0001'


def upgrade():
    op.add_column('content_items', sa.Column('source_claims', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False))


def downgrade():
    op.drop_column('content_items', 'source_claims')
