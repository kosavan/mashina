from datetime import datetime, timezone
import json
from zipfile import ZipFile

from fastapi.testclient import TestClient

from backend.scheduled_backup import BackupSchedule, ScheduledBackups


def test_daily_schedule_verification_and_retention(client, tmp_path):
    endpoint = "/api/v1/admin/backup-schedule"
    assert client.get(endpoint).json()["schedule"]["enabled"] is False
    assert client.put(endpoint, json={"directory": "../outside"}).status_code == 422

    config = {"enabled": True, "directory": "verified", "hour_utc": 4, "keep": 1}
    assert client.put(endpoint, json=config).json()["schedule"] == config
    service = ScheduledBackups(client.app.state.store)
    directory = tmp_path / "backups" / "verified"
    service.tick(datetime(2026, 1, 2, 3, tzinfo=timezone.utc))
    assert not directory.exists()
    service.tick(datetime(2026, 1, 2, 4, tzinfo=timezone.utc))
    first = directory / "mashina-auto-2026-01-02.zip"
    with ZipFile(first) as archive:
        assert archive.testzip() is None
        assert {"manifest.json", "database.sqlite"}.issubset(archive.namelist())
    original = first.stat().st_mtime_ns
    service.tick(datetime(2026, 1, 2, 5, tzinfo=timezone.utc))
    assert first.stat().st_mtime_ns == original
    manual = directory / "manual.zip"
    manual.write_bytes(b"owner-managed file")
    service.tick(datetime(2026, 1, 3, 4, tzinfo=timezone.utc))
    assert not first.exists()
    assert manual.exists()
    assert client.get(endpoint).json()["last_verified"]["date"] == "2026-01-03"
    assert TestClient(client.app).get(endpoint).status_code == 401


def test_failed_archive_preserves_verified_copy_and_skips_retention(client, tmp_path, monkeypatch):
    service = ScheduledBackups(client.app.state.store)
    service.configure(BackupSchedule(enabled=True, hour_utc=0, keep=1))
    service.tick(datetime(2026, 1, 2, tzinfo=timezone.utc))
    directory = tmp_path / "backups" / "daily"
    first = directory / "mashina-auto-2026-01-02.zip"
    original = first.read_bytes()

    def bad_snapshot(_store, path):
        with ZipFile(path, "w") as archive:
            archive.writestr("database.sqlite", b"wrong contents")
            archive.writestr("manifest.json", json.dumps({
                "format": 1, "files": {"database.sqlite": "not its actual hash"},
            }))

    monkeypatch.setattr("backend.scheduled_backup.save_backup", bad_snapshot)
    service.tick(datetime(2026, 1, 3, tzinfo=timezone.utc))
    state = service.read()
    assert state["last_run"]["verified"] is False
    assert state["last_verified"]["date"] == "2026-01-02"
    assert first.read_bytes() == original
    assert list(directory.iterdir()) == [first]
