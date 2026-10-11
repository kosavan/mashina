"""Add private ownership tools without modifying existing history."""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    for name in ("tire_sets", "budgets", "recurring_costs"):
        op.create_table(
            name,
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("owner_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("data", sa.Text(), nullable=False),
            sa.Column("deleted", sa.Integer(), nullable=False, server_default="0"),
        )
        op.create_index(f"ix_{name}_owner_vehicle", name, ["owner_id", "vehicle_id"])


def downgrade():
    raise RuntimeError("Destructive downgrade refused; restore a verified backup.")
