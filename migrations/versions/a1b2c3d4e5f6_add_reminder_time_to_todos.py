"""add reminder_time to todos

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-10-31 17:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add reminder_time column to todos table."""
    op.add_column('todos', sa.Column('reminder_time', sa.Time(), nullable=True))


def downgrade() -> None:
    """Downgrade schema: drop reminder_time column from todos table."""
    op.drop_column('todos', 'reminder_time')
