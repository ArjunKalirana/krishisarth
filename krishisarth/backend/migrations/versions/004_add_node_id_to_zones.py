"""add node_id to zones

Revision ID: 004
Revises: 003
Create Date: 2026-04-16 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add node_id for MongoDB synchronization
    op.add_column('zones', sa.Column('node_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_zones_node_id'), 'zones', ['node_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_zones_node_id'), table_name='zones')
    op.drop_column('zones', 'node_id')
