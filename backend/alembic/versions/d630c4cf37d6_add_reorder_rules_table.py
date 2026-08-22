"""add reorder_rules table

Revision ID: d630c4cf37d6
Revises: e17a03242909
Create Date: 2026-08-22 18:30:38.632165

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd630c4cf37d6'
down_revision: Union[str, None] = 'e17a03242909'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reorder_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=50), nullable=False),
        sa.Column("brand", sa.String(length=100), nullable=True),
        sa.Column("threshold_g", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("reorder_rules")
