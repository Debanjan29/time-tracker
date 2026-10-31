"""create todos and completions tables

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-10-08 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create todos and todo_completions tables."""
    # 1. Create todos table
    op.create_table(
        'todos',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('is_daily', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_disabled', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('disabled_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_todos_user_id', 'todos', ['user_id'], unique=False)
    op.create_index('ix_todos_user_start_date', 'todos', ['user_id', 'start_date'], unique=False)

    # 2. Create todo_completions table
    op.create_table(
        'todo_completions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('todo_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['todo_id'], ['todos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('todo_id', 'date', name='uq_todo_completion_todo_date')
    )
    op.create_index('ix_todo_completions_todo_id', 'todo_completions', ['todo_id'], unique=False)
    op.create_index('ix_todo_completions_user_id', 'todo_completions', ['user_id'], unique=False)
    op.create_index('ix_todo_completions_user_date', 'todo_completions', ['user_id', 'date'], unique=False)


def downgrade() -> None:
    """Downgrade schema: drop todo_completions and todos tables."""
    op.drop_index('ix_todo_completions_user_date', table_name='todo_completions')
    op.drop_index('ix_todo_completions_user_id', table_name='todo_completions')
    op.drop_index('ix_todo_completions_todo_id', table_name='todo_completions')
    op.drop_table('todo_completions')

    op.drop_index('ix_todos_user_start_date', table_name='todos')
    op.drop_index('ix_todos_user_id', table_name='todos')
    op.drop_table('todos')
