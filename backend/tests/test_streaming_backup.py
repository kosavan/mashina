import hashlib
import io
import json
from pathlib import Path
import random
import tracemalloc
import zipfile

import pytest

from backend.backup import save_backup, restore_backup
from backend.storage import Store
from backend.tests.test_api import mutate


def test_large_archive_roundtrip_uses_bounded_memory(client, tmp_path, monkeypatch):
    from PIL import Image
    store = client.app.state.store
    car = mutate(client, "vehicle", {"name": "Large archive"}).json()["record"]
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(image, "PNG")
    attachment = client.post("/api/v1/attachments", data={"vehicle_id": car["id"]},
                            files={"file": ("tiny.png", image.getvalue(), "image/png")}).json()
    row = store.query("SELECT filename,data FROM attachments WHERE id=?", (attachment["id"],))[0]
    path = store.uploads / row["filename"]
    block = random.Random(16).randbytes(1024 * 1024)
    digest = hashlib.sha256()
    with path.open("wb") as output:
        for _ in range(201):
            output.write(block)
            digest.update(block)
    meta = json.loads(row["data"])
    meta.update(sha256=digest.hexdigest(), size=path.stat().st_size)
    with store.transaction() as connection:
        connection.exec_driver_sql("UPDATE attachments SET data=? WHERE id=?", (json.dumps(meta), attachment["id"]))
    archive = tmp_path / "large.zip"
    original_read_bytes = Path.read_bytes

    def bounded_read(path):
        assert path.stat().st_size < 1024 * 1024, "Large file loaded in memory"
        return original_read_bytes(path)

    monkeypatch.setattr(Path, "read_bytes", bounded_read)
    restored = Store(tmp_path / "restored")
    tracemalloc.start()
    try:
        save_backup(store, archive)
        assert archive.stat().st_size > 200 * 1024 * 1024
        restore_backup(restored, archive)
        _, peak = tracemalloc.get_traced_memory()
        assert peak < 24 * 1024 * 1024, peak
        print(f"Archive {archive.stat().st_size / 1024**2:.2f} MiB; peak Python allocation {peak / 1024**2:.2f} MiB")
        with (restored.uploads / row["filename"]).open("rb") as source:
            assert hashlib.file_digest(source, "sha256").hexdigest() == meta["sha256"]
        assert restored.state(store.query("SELECT id FROM users")[0]["id"])["vehicles"][0]["id"] == car["id"]
    finally:
        tracemalloc.stop()
        restored.close()


def test_archive_publication_is_atomic_on_disk_error(client, tmp_path, monkeypatch):
    from backend import backup
    target = tmp_path / "saved.zip"
    target.write_bytes(b"previous-complete-archive")
    def failing_writer(store, output):
        output.write(b"incomplete")
        raise OSError("simulated disk full")
    monkeypatch.setattr(backup, "write_backup", failing_writer)
    with pytest.raises(OSError):
        save_backup(client.app.state.store, target)
    assert target.read_bytes() == b"previous-complete-archive"
    assert list(tmp_path.glob(".mashina-backup-*")) == []


def test_restore_stream_rejects_noncanonical_and_duplicate_paths_before_changes(client):
    for names in [("uploads//x.bin",), ("uploads/a.bin", "uploads/A.bin")]:
        source = io.BytesIO()
        with zipfile.ZipFile(source, "w") as archive:
            for name in names:
                archive.writestr(name, b"bad")
        with pytest.raises(ValueError):
            restore_backup(client.app.state.store, source)
    assert client.get("/api/v1/state").status_code == 200


def test_backup_download_cleans_disk_file_and_api_accepts_seekable_upload(client):
    store = client.app.state.store
    car = mutate(client, "vehicle", {"name": "Streamed API"}).json()["record"]
    response = client.get("/api/v1/backup")
    assert response.status_code == 200
    assert not list(store.path.glob("download-*.zip"))
    response = client.post("/api/v1/restore", files={"file": ("archive.zip", response.content, "application/zip")})
    assert response.status_code == 200 and response.json()["login_required"]
    assert store.query("SELECT id FROM vehicles")[0]["id"] == car["id"]


def test_streamed_restore_uses_data_volume_and_cleans_failed_upload(client, monkeypatch):
    from backend.backup import make_backup
    store = client.app.state.store
    archive = make_backup(store)
    response = client.post("/api/v1/restore/stream", content=b"invalid", headers={"Content-Type": "application/zip"})
    assert response.status_code == 422
    assert not list(store.path.glob("restore-upload-*"))
    response = client.post("/api/v1/restore/stream", content=archive, headers={"Content-Type": "application/zip"})
    assert response.status_code == 200 and response.json()["login_required"]
    assert not list(store.path.glob("restore-upload-*"))


def test_download_disconnect_cleans_temporary_archive(tmp_path):
    import asyncio
    from backend.app import ArchiveFileResponse
    target = tmp_path / "download.zip"
    target.write_bytes(b"archive")
    async def disconnected_send(message):
        raise OSError("synthetic disconnect")
    async def receive():
        return {"type": "http.disconnect"}
    from starlette.requests import ClientDisconnect
    with pytest.raises((OSError, ClientDisconnect)):
        asyncio.run(ArchiveFileResponse(target)({"type": "http", "method": "GET", "headers": [], "asgi": {"spec_version": "2.4"}}, receive, disconnected_send))
    assert not target.exists()


def test_streamed_restore_checks_permissions_content_type_and_actual_byte_limit(client, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.tests.test_access import account
    with TestClient(client.app) as anonymous:
        assert anonymous.post("/api/v1/restore/stream", content=b"data").status_code == 401
    other, _ = account(client, "restore-other")
    assert other.post("/api/v1/restore/stream", content=b"data").status_code == 403
    assert client.post("/api/v1/restore/stream", content=b"data").status_code == 415
    monkeypatch.setattr("backend.app.MAX_ARCHIVE", 4)
    response = client.post("/api/v1/restore/stream", content=iter([b"abc", b"def"]), headers={"Content-Type": "application/zip"})
    assert response.status_code == 413
    assert not list(client.app.state.store.path.glob("restore-upload-*"))
