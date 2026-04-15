"""add ml precision fields

Revision ID: 003
Revises: 002
Create Date: 2026-04-15 17:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new environmental and soil mineral fields for high-precision ML
    op.add_column('zones', sa.Column('ph', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('rainfall', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('ec', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('oc', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('s', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('zn', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('fe', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('cu', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('mn', sa.Float(), nullable=True))
    op.add_column('zones', sa.Column('b', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('zones', 'b')
    op.drop_column('zones', 'mn')
    op.drop_column('zones', 'cu')
    op.drop_column('zones', 'fe')
    op.drop_column('zones', 'zn')
    op.drop_column('zones', 's')
    op.drop_column('zones', 'oc')
    op.drop_column('zones', 'ec')
    op.drop_column('zones', 'rainfall')
    op.drop_column('zones', 'ph')
