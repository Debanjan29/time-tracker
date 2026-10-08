"""create calendar_notes table

Revision ID: bbc376168cd2
Revises: fa5b37d22dea
Create Date: 2026-10-05 23:33:56.538183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bbc376168cd2'
down_revision: Union[str, Sequence[str], None] = 'fa5b37d22dea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create calendar_notes table and index."""
    op.create_table(
        'calendar_notes',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_calendar_notes_user_id', 'calendar_notes', ['user_id'], unique=False)
    op.create_index('ix_calendar_notes_user_date', 'calendar_notes', ['user_id', 'date'], unique=False)


def downgrade() -> None:
    """Downgrade schema: drop calendar_notes table and indexes."""
    op.drop_index('ix_calendar_notes_user_date', table_name='calendar_notes')
    op.drop_index('ix_calendar_notes_user_id', table_name='calendar_notes')
    op.drop_table('calendar_notes')
