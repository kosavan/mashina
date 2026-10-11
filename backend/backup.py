"""Consistent SQLite + file snapshots and validated rollback-safe restore."""

from contextlib import closing
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import tempfile
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
    if len(blob) > MAX_ARCHIVE:
        raise ValueError("Архив превышает 200 МБ")
    try:
        with tempfile.TemporaryDirectory(dir=store.path.parent) as work:
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
                if check.execute("SELECT version_num FROM alembic_version").fetchone()[0] != "001":
                    raise ValueError("Версия архива несовместима")
                if check.execute("SELECT count(*) FROM users").fetchone()[0] != 1:
                    raise ValueError("Ожидается один владелец MVP")
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
                check.execute("DELETE FROM sessions")
                check.commit()
            (stage / "uploads").mkdir(exist_ok=True)
            with store.lock:
                # Retain a complete pre-restore snapshot as recovery path.
                recovery = store.path / "pre-restore.zip"
                recovery.write_bytes(make_backup(store))
                with store.engine.connect() as c:
                    c.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
                store.engine.dispose()
                live = store.path / "mashina.db"
                previous = stage / "previous.sqlite"
                previous_uploads = stage / "previous-uploads"
                os.replace(live, previous)
                os.replace(store.uploads, previous_uploads)
                try:
                    os.replace(snapshot, live)
                    os.replace(stage / "uploads", store.uploads)
                except OSError:
                    os.replace(previous, live)
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
