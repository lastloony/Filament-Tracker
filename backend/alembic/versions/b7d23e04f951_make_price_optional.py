"""Allow unknown purchase prices while preserving existing amounts."""
from alembic import op
import sqlalchemy as sa

revision = "b7d23e04f951"
down_revision = "a42e8d91bc70"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("filaments") as batch:
        batch.alter_column("price", existing_type=sa.Numeric(10, 2), nullable=True)


def downgrade() -> None:
    missing = op.get_bind().scalar(sa.text("SELECT count(*) FROM filaments WHERE price IS NULL"))
    if missing:
        raise RuntimeError("Cannot restore required price: fill in missing prices before downgrade.")
    with op.batch_alter_table("filaments") as batch:
        batch.alter_column("price", existing_type=sa.Numeric(10, 2), nullable=False)
