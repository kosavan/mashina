"""Consistent SQLite + file snapshots and validated rollback-safe restore."""

from contextlib import closing
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import tempfile
import time
import zipfile

MAX_ARCHIVE = 200 * 1024 * 1024


def make_backup(store):
    output = io.BytesIO()
    with store.lock, tempfile.TemporaryDirectory(dir=store.path) as work:
        snapshot = Path(work) / "database.sqlite"
        with store.engine.connect() as connection, closing(sqlite3.connect(snapshot)) as target:
            connection.connection.driver_connection.backup(target)
        content = {"database.sqlite": snapshot.read_bytes()}
        for attachment in store.query("SELECT filename FROM attachments"):
            filename = attachment["filename"]
            content["uploads/" + filename] = (store.uploads / filename).read_bytes()
        manifest = {
            "format": 1,
            "files": {name: hashlib.sha256(value).hexdigest() for name, value in content.items()},
        }
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, value in content.items():
                archive.writestr(name, value)
            archive.writestr("manifest.json", json.dumps(manifest))
    return output.getvalue()


def restore_backup(store, blob):
    from backend.notifications import notification_guard

    with notification_guard(store.path):
        return _restore_backup(store, blob)


def _restore_backup(store, blob):
    if len(blob) > MAX_ARCHIVE:
        raise ValueError("Архив превышает 200 МБ")
    try:
        # Staging must share the writable data volume and filesystem with live files.
        # The parent is read-only in Compose and may be on another filesystem.
        with tempfile.TemporaryDirectory(dir=store.path) as work:
            stage = Path(work)
            with zipfile.ZipFile(io.BytesIO(blob)) as archive:
                info = archive.infolist()
                names = [i.filename for i in info]
                if len(names) != len(set(names)) or sum(i.file_size for i in info) > MAX_ARCHIVE:
                    raise ValueError("Дубликаты или слишком большой архив")
                for name in names:
                    path = PurePosixPath(name)
                    if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
                        raise ValueError("Недопустимый путь в архиве")
                manifest = json.loads(archive.read("manifest.json"))
                if manifest.get("format") != 1 or set(manifest["files"]) != set(names) - {
                    "manifest.json"
                }:
                    raise ValueError("Некорректный манифест")
                for name, expected in manifest["files"].items():
                    data = archive.read(name)
                    if hashlib.sha256(data).hexdigest() != expected:
                        raise ValueError("Контрольная сумма не совпадает")
                    target = stage / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
            snapshot = stage / "database.sqlite"
            with closing(sqlite3.connect(snapshot)) as check:
                check.execute("PRAGMA foreign_keys=ON")
                if (
                    check.execute("PRAGMA integrity_check").fetchone()[0] != "ok"
                    or check.execute("PRAGMA foreign_key_check").fetchall()
                ):
                    raise ValueError("Нарушена целостность базы")
                if check.execute("SELECT version_num FROM alembic_version").fetchone()[0] not in {
                    "001",
                    "002",
                    "003",
                    "004",
                    "005",
                    "006",
                    "007",
                }:
                    raise ValueError("Версия архива несовместима")
                revision = check.execute("SELECT version_num FROM alembic_version").fetchone()[0]
                if revision in {"001", "002"}:
                    if check.execute("SELECT count(*) FROM users").fetchone()[0] != 1:
                        raise ValueError("Архив прежней версии должен содержать одного владельца")
                else:
                    if not check.execute(
                        "SELECT id FROM users WHERE is_admin=1 AND disabled=0 LIMIT 1"
                    ).fetchone():
                        raise ValueError("В архиве нет действующего администратора")
                    if check.execute(
                        "SELECT 1 FROM vehicle_access WHERE role NOT IN ('owner','driver') LIMIT 1"
                    ).fetchone():
                        raise ValueError("Некорректная роль доступа")
                    for table in ("events", "attachments"):
                        if check.execute(
                            f"SELECT 1 FROM {table} LEFT JOIN users ON users.id={table}.created_by WHERE users.id IS NULL LIMIT 1"
                        ).fetchone():
                            raise ValueError("Автор записи отсутствует")
                    for table in (
                        "events",
                        "reminders",
                        "tire_sets",
                        "budgets",
                        "recurring_costs",
                        "attachments",
                    ):
                        if check.execute(
                            f"SELECT 1 FROM {table} JOIN vehicles ON vehicles.id={table}.vehicle_id WHERE {table}.owner_id<>vehicles.owner_id LIMIT 1"
                        ).fetchone():
                            raise ValueError("Несогласованный владелец записи")
                    if check.execute(
                        "SELECT 1 FROM attachments WHERE visibility NOT IN ('owner','shared') LIMIT 1"
                    ).fetchone():
                        raise ValueError("Некорректный доступ к документу")
                if check.execute(
                    "SELECT 1 FROM attachments JOIN events ON events.id=attachments.event_id WHERE events.vehicle_id<>attachments.vehicle_id LIMIT 1"
                ).fetchone():
                    raise ValueError("Документ связан с другим автомобилем")
                for filename, metadata in check.execute("SELECT filename,data FROM attachments"):
                    if (
                        PurePosixPath(filename).name != filename
                        or "\\" in filename
                        or ":" in filename
                        or not filename.endswith(".bin")
                    ):
                        raise ValueError("Недопустимое имя вложения")
                    target = stage / "uploads" / filename
                    meta = json.loads(metadata)
                    if (
                        not target.is_file()
                        or hashlib.sha256(target.read_bytes()).hexdigest() != meta["sha256"]
                    ):
                        raise ValueError("Вложение отсутствует или повреждено")
                from backend.domain import normalize_reminder

                for (data,) in check.execute("SELECT data FROM reminders"):
                    normalize_reminder(json.loads(data))
                if revision in {"005", "006", "007"}:
                    from backend.bank_archive import validate_bank_archive

                    validate_bank_archive(check)
                    check.execute("DELETE FROM bank_preview_batches")
                if revision in {"006", "007"}:
                    from backend.machine_archive import validate_machine_archive

                    validate_machine_archive(check)
                    check.execute(
                        "UPDATE machine_credentials SET revoked=? WHERE revoked IS NULL",
                        (int(time.time()),),
                    )
                if revision in {"004", "005", "006", "007"}:
                    from backend.notifications import validate_notification_archive

                    validate_notification_archive(check)
                    check.execute("UPDATE notification_identity SET paused=1")
                    check.execute("UPDATE notification_preferences SET enabled=0")
                    check.execute("DELETE FROM telegram_link_codes")
                    check.execute(
                        "UPDATE notification_deliveries SET state='uncertain',error_code='restored_pending' WHERE state='sending'"
                    )
                if revision == "007":
                    from backend.body_damage import validate_body_archive

                    validate_body_archive(check)
                check.execute("DELETE FROM sessions")
                check.commit()
            (stage / "uploads").mkdir(exist_ok=True)
            with store.lock:
                # Retain a complete pre-restore snapshot as recovery path.
                recovery = store.path / "pre-restore.zip"
                recovery.write_bytes(make_backup(store))
                recovery.chmod(0o600)
                with store.engine.connect() as c:
                    c.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
                store.engine.dispose()
                live = store.path / "mashina.db"
                previous = stage / "previous.sqlite"
                previous_uploads = stage / "previous-uploads"
                try:
                    os.replace(live, previous)
                    os.replace(store.uploads, previous_uploads)
                    os.replace(snapshot, live)
                    os.replace(stage / "uploads", store.uploads)
                    store.migrate()
                    with store.transaction() as c:
                        c.exec_driver_sql("UPDATE notification_identity SET paused=1")
                        c.exec_driver_sql("UPDATE notification_preferences SET enabled=0")
                        c.exec_driver_sql(
                            "UPDATE machine_credentials SET revoked=? WHERE revoked IS NULL",
                            (int(time.time()),),
                        )
                except Exception:
                    store.engine.dispose()
                    if previous.exists():
                        for suffix in ("-wal", "-shm"):
                            sidecar = Path(str(live) + suffix)
                            if sidecar.exists():
                                os.replace(sidecar, stage / ("failed" + suffix))
                        os.replace(previous, live)
                    if previous_uploads.exists():
                        if store.uploads.exists():
                            os.replace(store.uploads, stage / "failed-uploads")
                        os.replace(previous_uploads, store.uploads)
                    raise
    except (
        zipfile.BadZipFile,
        KeyError,
        json.JSONDecodeError,
        sqlite3.DatabaseError,
        TypeError,
    ) as exc:
        raise ValueError("Некорректный или повреждённый архив") from exc
