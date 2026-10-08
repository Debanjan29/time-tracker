"""add username to users and make email optional

Revision ID: e4f5a6b7c8d9
Revises: bbc376168cd2
Create Date: 2026-10-08 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'bbc376168cd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add username column, make email nullable."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column('username', sa.String(length=30), nullable=False, server_default='')
        )
        batch_op.alter_column('email', existing_type=sa.String(length=255), nullable=True)
        batch_op.create_index('ix_users_username', ['username'], unique=True)


def downgrade() -> None:
    """Downgrade schema: drop username column, make email not nullable."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_username')
        batch_op.alter_column('email', existing_type=sa.String(length=255), nullable=False)
        batch_op.drop_column('username')
