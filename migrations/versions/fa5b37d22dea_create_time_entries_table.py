"""create time_entries table

Revision ID: fa5b37d22dea
Revises: ba372a391930
Create Date: 2026-10-05 23:23:37.428832

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa5b37d22dea'
down_revision: Union[str, Sequence[str], None] = 'ba372a391930'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create time_entries table, check constraint, and partial unique index."""
    op.create_table(
        'time_entries',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('end_time IS NULL OR end_time > start_time', name='check_end_after_start')
    )
    op.create_index('ix_time_entries_user_id', 'time_entries', ['user_id'], unique=False)
    op.create_index('ix_time_entries_user_start', 'time_entries', ['user_id', 'start_time'], unique=False)
    
    # Partial unique index: at most one active entry (end_time IS NULL) per user
    op.create_index(
        'ix_one_active_timer_per_user',
        'time_entries',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text('end_time IS NULL'),
        sqlite_where=sa.text('end_time IS NULL')
    )


def downgrade() -> None:
    """Downgrade schema: drop time_entries table and indexes."""
    op.drop_index('ix_one_active_timer_per_user', table_name='time_entries')
    op.drop_index('ix_time_entries_user_start', table_name='time_entries')
    op.drop_index('ix_time_entries_user_id', table_name='time_entries')
    op.drop_table('time_entries')
