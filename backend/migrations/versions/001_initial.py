"""Initial additive schema. Never destroys user data on downgrade."""

from alembic import op
from backend.schema import schema_v1

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    schema_v1().create_all(bind=op.get_bind())


def downgrade():
    raise RuntimeError("Destructive downgrade refused. Restore a verified pre-migration backup.")
