"""Local accounts, vehicle grants and immutable authorship."""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("is_admin", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("disabled", sa.Integer(), nullable=False, server_default="0"))
    # Older releases only allowed a single local installation owner.
    op.execute("UPDATE users SET is_admin=1")
    op.create_table(
        "vehicle_access",
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.CheckConstraint("role IN ('owner','driver')", name="ck_vehicle_access_role"),
    )
    op.create_index("ix_vehicle_access_user", "vehicle_access", ["user_id"])
    # Nullable additive columns permit the backfill without rebuilding FK-linked tables.
    for table in ("events", "attachments"):
        op.execute(f"ALTER TABLE {table} ADD COLUMN created_by TEXT REFERENCES users(id)")
        op.execute(f"UPDATE {table} SET created_by=owner_id")
    op.add_column(
        "attachments", sa.Column("visibility", sa.String(), nullable=False, server_default="owner")
    )
    # Existing cover selection was an explicit public-to-members vehicle presentation choice.
    op.execute(
        "UPDATE attachments SET visibility='shared' WHERE id IN (SELECT json_extract(data,'$.photo_id') FROM vehicles)"
    )


def downgrade():
    raise RuntimeError("Destructive downgrade refused; restore a verified backup.")
