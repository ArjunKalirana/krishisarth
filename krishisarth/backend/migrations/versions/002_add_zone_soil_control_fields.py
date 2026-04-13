"""add zone soil control fields

Revision ID: 002
Revises: 001
Create Date: 2026-04-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new performance and analysis fields to zones
    op.add_column('zones', sa.Column('soil_type', sa.String(), nullable=True))
    op.add_column('zones', sa.Column('soil_report', sa.Text(), nullable=True))
    op.add_column('zones', sa.Column('soil_scan_url', sa.String(), nullable=True))
    op.add_column('zones', sa.Column('control_mode', sa.String(), server_default='view', nullable=False))
    op.add_column('zones', sa.Column('crop_suggestion', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('zones', 'crop_suggestion')
    op.drop_column('zones', 'control_mode')
    op.drop_column('zones', 'soil_scan_url')
    op.drop_column('zones', 'soil_report')
    op.drop_column('zones', 'soil_type')
