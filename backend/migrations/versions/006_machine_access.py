"""Explicit original-owner machine credentials and isolated operation receipts."""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "machine_credentials",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False, unique=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False),
        sa.Column("revoked", sa.Integer()),
        sa.Column("write_enabled", sa.Integer(), nullable=False),
        sa.CheckConstraint("length(label) BETWEEN 1 AND 80"),
        sa.CheckConstraint("length(token_hash)=64"),
        sa.CheckConstraint("expires>created AND expires<=created+31536000"),
        sa.CheckConstraint("write_enabled IN (0,1)"),
    )
    op.create_index("ix_machine_user", "machine_credentials", ["user_id"])
    op.create_table(
        "machine_vehicle_grants",
        sa.Column(
            "credential_id", sa.String(), sa.ForeignKey("machine_credentials.id"), primary_key=True
        ),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), primary_key=True),
    )
    op.create_table(
        "machine_receipts",
        sa.Column(
            "credential_id", sa.String(), sa.ForeignKey("machine_credentials.id"), primary_key=True
        ),
        sa.Column("operation_id", sa.String(), primary_key=True),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("entity", sa.String(), nullable=False),
        sa.Column("record_id", sa.String(), nullable=False),
        sa.Column("payload_hash", sa.String(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
        sa.CheckConstraint("entity IN ('event','reminder')"),
    )
    # Events are JSON-backed; expression index keeps the existing storage format.
    op.execute(
        "CREATE INDEX ix_machine_history ON events(vehicle_id,deleted,json_extract(data,'$.occurred_at') DESC,id DESC)"
    )


def downgrade():
    raise RuntimeError("Destructive downgrade refused; restore a verified backup.")
