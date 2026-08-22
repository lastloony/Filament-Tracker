"""add color_hex to filaments

Revision ID: e17a03242909
Revises: 6ff1611de32e
Create Date: 2026-08-22 18:07:24.729274

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e17a03242909'
down_revision: Union[str, None] = '6ff1611de32e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("filaments", sa.Column("color_hex", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("filaments", "color_hex")
