"""initial schema"""
import sqlalchemy as sa
import pgvector.sqlalchemy
from alembic import op
from sqlalchemy.dialects import postgresql
revision = '0001'
down_revision = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('timezone', sa.String(length=64), server_default='UTC', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('brand_profiles',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('tone', sa.Text(), nullable=True),
    sa.Column('audience', sa.Text(), nullable=True),
    sa.Column('expertise', sa.Text(), nullable=True),
    sa.Column('style_preferences', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_brand_profiles_user_id'), 'brand_profiles', ['user_id'], unique=True)
    op.create_table('content_items',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('source_text', sa.Text(), nullable=True),
    sa.Column('source_type', sa.String(length=32), nullable=False),
    sa.Column('format', sa.String(length=32), nullable=False),
    sa.Column('hook', sa.Text(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('cta', sa.Text(), nullable=False),
    sa.Column('hashtags', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_content_items_user_id'), 'content_items', ['user_id'], unique=False)
    op.create_index('ix_content_user_status', 'content_items', ['user_id', 'status'], unique=False)
    op.create_table('content_plans',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('plan_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_content_plans_user_id'), 'content_plans', ['user_id'], unique=False)
    op.create_table('feedback',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('content_item_id', sa.Uuid(), nullable=False),
    sa.Column('action', sa.String(length=32), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_feedback_user_id'), 'feedback', ['user_id'], unique=False)
    op.create_table('knowledge_chunks',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('source_content_id', sa.Uuid(), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=1536), nullable=True),
    sa.Column('embedding_model', sa.String(length=100), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['source_content_id'], ['content_items.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_knowledge_chunks_user_id'), 'knowledge_chunks', ['user_id'], unique=False)
    op.create_table('post_metrics',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('content_item_id', sa.Uuid(), nullable=False),
    sa.Column('impressions', sa.Integer(), nullable=True),
    sa.Column('reactions', sa.Integer(), nullable=True),
    sa.Column('comments', sa.Integer(), nullable=True),
    sa.Column('shares', sa.Integer(), nullable=True),
    sa.Column('source', sa.String(length=16), nullable=False),
    sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_post_metrics_user_id'), 'post_metrics', ['user_id'], unique=False)
    op.create_table('scheduled_jobs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('content_item_id', sa.Uuid(), nullable=True),
    sa.Column('job_type', sa.String(length=32), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('run_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
    sa.Column('max_attempts', sa.Integer(), server_default='3', nullable=False),
    sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_error', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_jobs_due', 'scheduled_jobs', ['status', 'run_at'], unique=False)
    op.create_index(op.f('ix_scheduled_jobs_user_id'), 'scheduled_jobs', ['user_id'], unique=False)
    op.create_index('ix_knowledge_chunks_embedding', 'knowledge_chunks', ['embedding'], postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})


def downgrade():
    op.drop_index(op.f('ix_scheduled_jobs_user_id'), table_name='scheduled_jobs')
    op.drop_index('ix_jobs_due', table_name='scheduled_jobs')
    op.drop_table('scheduled_jobs')
    op.drop_index(op.f('ix_post_metrics_user_id'), table_name='post_metrics')
    op.drop_table('post_metrics')
    op.drop_index(op.f('ix_knowledge_chunks_user_id'), table_name='knowledge_chunks')
    op.drop_table('knowledge_chunks')
    op.drop_index(op.f('ix_feedback_user_id'), table_name='feedback')
    op.drop_table('feedback')
    op.drop_index(op.f('ix_content_plans_user_id'), table_name='content_plans')
    op.drop_table('content_plans')
    op.drop_index('ix_content_user_status', table_name='content_items')
    op.drop_index(op.f('ix_content_items_user_id'), table_name='content_items')
    op.drop_table('content_items')
    op.drop_index(op.f('ix_brand_profiles_user_id'), table_name='brand_profiles')
    op.drop_table('brand_profiles')
    op.drop_table('users')
