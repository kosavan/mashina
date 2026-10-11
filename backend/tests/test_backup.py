import io
import zipfile
import pytest
from backend.backup import make_backup, restore_backup
from backend.tests.test_api import mutate


def test_backup_files_roundtrip(client, tmp_path):
    from PIL import Image

    car = mutate(client, "vehicle", {"name": "Backup car"}).json()["record"]
    image = io.BytesIO()
    Image.new("RGB", (16, 16), "red").save(image, format="PNG")
    upload = client.post(
        "/api/v1/attachments",
        data={"vehicle_id": car["id"], "title": "Photo"},
        files={"file": ("test.png", image.getvalue(), "image/png")},
    )
    assert upload.status_code == 200, upload.text
    aid = upload.json()["id"]
    original = client.get(f"/api/v1/attachments/{aid}").content
    archive = client.get("/api/v1/backup").content
    from backend.storage import Store

    restored = Store(tmp_path / "restored")
    restore_backup(restored, archive)
    owner = restored.query("SELECT id FROM users")[0]["id"]
    state = restored.state(owner)
    assert state["vehicles"][0]["id"] == car["id"]
    meta = restored.query("SELECT filename FROM attachments WHERE id=?", (aid,))[0]
    assert (restored.uploads / meta["filename"]).read_bytes() == original
    assert restored.query("SELECT * FROM sessions") == []
    restored.close()


def test_reject_corrupt_archive_before_changes(client):
    store = client.app.state.store
    before = make_backup(store)
    broken = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(before)) as source, zipfile.ZipFile(broken, "w") as out:
        for item in source.infolist():
            out.writestr(
                item.filename, b"bad" if item.filename == "manifest.json" else source.read(item)
            )
    with pytest.raises(ValueError):
        restore_backup(store, broken.getvalue())
    assert store.query("SELECT username FROM users")[0]["username"] == "owner"


def test_deny_path_traversal(client):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as out:
        out.writestr("../escape", "bad")
    with pytest.raises(ValueError):
        restore_backup(client.app.state.store, buffer.getvalue())
