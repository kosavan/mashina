"""Private immutable bank previews and durable reviewed reconciliation."""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "bank_sources",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("normalized_label", sa.String(), nullable=False),
        sa.UniqueConstraint("actor_id", "normalized_label"),
        sa.CheckConstraint("length(label) BETWEEN 1 AND 80"),
    )
    op.create_table(
        "bank_preview_batches",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_id", sa.String(), sa.ForeignKey("bank_sources.id"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("file_hash", sa.String(), nullable=False),
        sa.Column("rows_json", sa.Text(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False),
    )
    op.create_index("ix_bank_batch_actor", "bank_preview_batches", ["actor_id", "created"])
    op.create_table(
        "bank_ledger",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_id", sa.String(), sa.ForeignKey("bank_sources.id"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("identity", sa.String(), nullable=False),
        sa.Column("fingerprint", sa.String(), nullable=False),
        sa.Column("file_hash", sa.String(), nullable=False),
        sa.Column("row_ordinal", sa.Integer(), nullable=False),
        sa.Column("normalized_data", sa.Text(), nullable=False),
        sa.Column("event_id", sa.String(), sa.ForeignKey("events.id"), unique=True),
        sa.Column("decision", sa.String(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
        sa.UniqueConstraint("source_id", "identity"),
        sa.CheckConstraint("decision IN ('create','link','ignore')"),
        sa.CheckConstraint(
            "(decision='ignore' AND event_id IS NULL) OR (decision<>'ignore' AND event_id IS NOT NULL)"
        ),
    )
    op.create_index("ix_bank_fingerprint", "bank_ledger", ["source_id", "fingerprint"])
    op.create_index("ix_bank_ledger_actor", "bank_ledger", ["actor_id", "vehicle_id"])
    op.create_table(
        "bank_commit_receipts",
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("operation_id", sa.String(), primary_key=True),
        sa.Column("batch_id", sa.String(), nullable=False),
        sa.Column("payload_hash", sa.String(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
    )


def downgrade():
    raise RuntimeError("Destructive downgrade refused; restore a verified backup.")
