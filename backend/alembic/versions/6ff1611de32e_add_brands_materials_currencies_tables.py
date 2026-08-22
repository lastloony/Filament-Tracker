"""add brands materials currencies tables

Revision ID: 6ff1611de32e
Revises: 56b5fb8378bc
Create Date: 2026-08-19 20:40:48.670480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ff1611de32e'
down_revision: Union[str, None] = '56b5fb8378bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU"]
BASE_CURRENCY = "RUB"


def upgrade() -> None:
    op.create_table(
        "brands",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "currencies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=3), nullable=False),
        sa.Column("is_base", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    bind = op.get_bind()
    brands_table = sa.table("brands", sa.column("name", sa.String))
    materials_table = sa.table("materials", sa.column("name", sa.String))
    currencies_table = sa.table("currencies", sa.column("code", sa.String), sa.column("is_base", sa.Boolean))

    existing_brands = {row[0] for row in bind.execute(sa.text("SELECT DISTINCT brand FROM filaments")) if row[0]}
    existing_materials = {
        row[0] for row in bind.execute(sa.text("SELECT DISTINCT material FROM filaments")) if row[0]
    }
    existing_currencies = {
        row[0] for row in bind.execute(sa.text("SELECT DISTINCT currency FROM filaments")) if row[0]
    }

    if existing_brands:
        op.bulk_insert(brands_table, [{"name": name} for name in sorted(existing_brands)])

    all_materials = sorted(set(DEFAULT_MATERIALS) | existing_materials)
    op.bulk_insert(materials_table, [{"name": name} for name in all_materials])

    other_currencies = sorted(existing_currencies - {BASE_CURRENCY})
    currency_rows = [{"code": BASE_CURRENCY, "is_base": True}]
    currency_rows += [{"code": code, "is_base": False} for code in other_currencies]
    op.bulk_insert(currencies_table, currency_rows)


def downgrade() -> None:
    op.drop_table("currencies")
    op.drop_table("materials")
    op.drop_table("brands")
