"""CI-only synthetic restore drill inside the read-only non-root production image."""

from pathlib import Path
import hashlib
import io
import json
import tempfile
import uuid

from backend.storage import Store
from backend.backup import make_backup, restore_backup


def main():
    with tempfile.TemporaryDirectory(dir="/app/data") as work:
        store = Store(Path(work) / "garage")
        owner = str(uuid.uuid4())
        with store.transaction() as c:
            c.exec_driver_sql(
                "INSERT INTO users(id,username,password_hash,is_admin) VALUES(?,?,?,1)",
                (owner, "synthetic-ci-owner", "!no-login"),
            )
        car = store.mutate(
            owner,
            {
                "operation_id": str(uuid.uuid4()),
                "id": str(uuid.uuid4()),
                "entity": "vehicle",
                "action": "create",
                "data": {"name": "CI preserved"},
            },
        )["record"]
        from PIL import Image

        picture = io.BytesIO()
        Image.new("RGB", (16, 16), "green").save(picture, format="PNG")
        aid = str(uuid.uuid4())
        filename = aid + ".bin"
        (store.uploads / filename).write_bytes(picture.getvalue())
        with store.transaction() as c:
            c.exec_driver_sql(
                "INSERT INTO attachments(id,owner_id,vehicle_id,filename,data,created_by) VALUES(?,?,?,?,?,?)",
                (
                    aid,
                    owner,
                    car["id"],
                    filename,
                    json.dumps(
                        {
                            "title": "Synthetic photo",
                            "media_type": "image/png",
                            "sha256": hashlib.sha256(picture.getvalue()).hexdigest(),
                        }
                    ),
                    owner,
                ),
            )
        damage = store.mutate(
            owner,
            {
                "operation_id": str(uuid.uuid4()),
                "id": str(uuid.uuid4()),
                "entity": "body_damage",
                "action": "create",
                "data": {
                    "vehicle_id": car["id"],
                    "title": "Preserved scratch",
                    "view": "left",
                    "panel": "left_front_door",
                    "x": 0.4,
                    "y": 0.55,
                    "discovered_on": "2026-01-01",
                    "status": "needs_repair",
                    "photos": [{"attachment_id": aid, "phase": "before"}],
                },
            },
        )["record"]
        blob = make_backup(store)
        restore_backup(store, blob)
        assert store.state(owner)["vehicles"][0]["id"] == car["id"]
        assert (store.uploads / filename).read_bytes() == picture.getvalue()
        store.close()
        reopened = Store(Path(work) / "garage")
        assert reopened.state(owner)["vehicles"][0]["name"] == "CI preserved"
        restored = reopened.state(owner)["body_damages"][0]
        assert restored["id"] == damage["id"]
        assert restored["photos"] == damage["photos"]
        assert restored["status_history"] == damage["status_history"]
        assert (reopened.uploads / filename).read_bytes() == picture.getvalue()
        reopened.close()
    print("Read-only non-root production container: backup, restore and restart passed.")


if __name__ == "__main__":
    main()
