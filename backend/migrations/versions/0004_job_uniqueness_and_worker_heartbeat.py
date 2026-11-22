"""one live job per post, worker heartbeat"""
import sqlalchemy as sa
from alembic import op
revision = '0004'
down_revision = '0003'


def upgrade():
    op.create_index('uq_jobs_one_live_per_item', 'scheduled_jobs', ['content_item_id'], unique=True, postgresql_where=sa.text("status IN ('queued', 'running')"))
    op.create_index('uq_content_user_slot', 'content_items', ['user_id', 'scheduled_at'], unique=True, postgresql_where=sa.text("status = 'scheduled'"))
    op.create_table('worker_heartbeats', sa.Column('name', sa.String(64), primary_key=True), sa.Column('seen_at', sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table('worker_heartbeats')
    op.drop_index('uq_content_user_slot', table_name='content_items')
    op.drop_index('uq_jobs_one_live_per_item', table_name='scheduled_jobs')
