"""Add DeepLee and Star Plast to existing brand dictionaries."""
from alembic import op
import sqlalchemy as sa

revision = "a42e8d91bc70"
down_revision = "f8a12b90c431"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {name.strip().casefold() for name in bind.execute(sa.text("SELECT name FROM brands")).scalars()}
    missing = [{"name": name} for name in ("DeepLee", "Star Plast") if name.casefold() not in existing]
    if missing:
        op.bulk_insert(sa.table("brands", sa.column("name", sa.String)), missing)


def downgrade() -> None:
    # Preserve names that may already be used by user filaments.
    pass
