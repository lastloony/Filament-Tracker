"""Add the default brand for spools with an unknown manufacturer."""
from alembic import op
import sqlalchemy as sa

revision = "c91f5e20ab64"
down_revision = "b7d23e04f951"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {name.strip().casefold() for name in bind.execute(sa.text("SELECT name FROM brands")).scalars()}
    if "нонейм" not in existing:
        op.bulk_insert(sa.table("brands", sa.column("name", sa.String)), [{"name": "Нонейм"}])


def downgrade() -> None:
    # Spools may use this name; keep user-visible dictionary data.
    pass
