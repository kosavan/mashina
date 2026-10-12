"""Add vehicle condition records without changing financial or odometer history."""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "body_damages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column("deleted", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("version>0 AND deleted IN (0,1)"),
    )
    op.create_index("ix_body_damage_owner_vehicle", "body_damages", ["owner_id", "vehicle_id"])


def downgrade():
    raise RuntimeError("Destructive downgrade refused; restore a verified backup.")
