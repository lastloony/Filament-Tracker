"""Seed common filament brands without replacing user data."""
from alembic import op
import sqlalchemy as sa

revision = "f8a12b90c431"
down_revision = "d630c4cf37d6"
branch_labels = None
depends_on = None

DEFAULT_BRANDS = (
    "Anycubic", "Bambu Lab", "Bestfilament", "Creality", "ELEGOO",
    "eSUN", "FDplast", "Fiberlogy", "Flashforge", "Overture",
    "Polymaker", "PrintProduct", "Prusament", "REC", "SUNLU",
)


def upgrade() -> None:
    bind = op.get_bind()
    existing = {name.strip().casefold() for name in bind.execute(sa.text("SELECT name FROM brands")).scalars()}
    missing = [{"name": name} for name in DEFAULT_BRANDS if name.casefold() not in existing]
    if missing:
        op.bulk_insert(sa.table("brands", sa.column("name", sa.String)), missing)


def downgrade() -> None:
    # Seeded brands may already be used in filaments. Keep dictionary data on rollback.
    pass
