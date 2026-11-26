"""Opt-in daily backups stored under one operator-controlled root."""

import asyncio
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import tempfile
from threading import RLock
from zipfile import BadZipFile, ZipFile

from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field

from backend.accounts import require_admin
from backend.backup import MAX_ARCHIVE, MAX_ENTRIES, save_backup


class BackupSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    directory: str = Field(default="daily", pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    hour_utc: int = Field(default=3, ge=0, le=23)
    keep: int = Field(default=7, ge=1, le=90)


def verify_scheduled_archive(path):
    with ZipFile(path) as archive:
        entries = archive.infolist()
        names = {entry.filename for entry in entries}
        if (
            len(entries) != len(names)
            or len(entries) > MAX_ENTRIES
            or sum(entry.file_size for entry in entries) > MAX_ARCHIVE
            or "manifest.json" not in names
            or archive.getinfo("manifest.json").file_size > 16 * 1024 * 1024
        ):
            raise ValueError("Повреждён архив резервной копии")
        manifest = json.loads(archive.read("manifest.json"))
        files = manifest.get("files") if isinstance(manifest, dict) else None
        if (
            not isinstance(files, dict) or manifest.get("format") != 1
            or "database.sqlite" not in files or names != {"manifest.json", *files}
        ):
            raise ValueError("Повреждён архив резервной копии")
        for name, expected in files.items():
            with archive.open(name) as entry:
                if hashlib.file_digest(entry, "sha256").hexdigest() != expected:
                    raise ValueError("Контрольная сумма не совпадает")


class ScheduledBackups:
    def __init__(self, store, root=None):
        self.store = store
        self.root = Path(root or os.getenv("MASHINA_BACKUP_ROOT") or store.path / "backups")
        self.metadata = store.path / ".automatic-backups.json"
        self.lock = RLock()

    def _read(self):
        if not self.metadata.exists():
            return {"schedule": BackupSchedule().model_dump(), "last_run": None, "last_verified": None}
        return json.loads(self.metadata.read_text(encoding="utf-8"))

    def _write(self, data):
        descriptor, temporary = tempfile.mkstemp(prefix=".automatic-backups-", dir=self.store.path)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                json.dump(data, output)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, self.metadata)
        finally:
            Path(temporary).unlink(missing_ok=True)

    def _directory(self, name):
        root = self.root.resolve()
        directory = root / name
        if directory.is_symlink() or directory.resolve().parent != root:
            raise ValueError("Недопустимая папка резервных копий")
        return directory

    def read(self):
        with self.lock:
            return self._read()

    def configure(self, schedule):
        with self.lock:
            self._directory(schedule.directory)
            data = self._read()
            if data["schedule"]["directory"] != schedule.directory:
                data["last_run"] = None
                data["last_verified"] = None
            data["schedule"] = schedule.model_dump()
            self._write(data)
            return data

    def tick(self, now=None):
        now = now or datetime.now(timezone.utc)
        today = now.date().isoformat()
        with self.lock:
            data = self._read()
            schedule = BackupSchedule.model_validate(data["schedule"])
            last_run = data["last_run"]
            if not schedule.enabled or now.hour < schedule.hour_utc:
                return
            if last_run and last_run["date"] == today:
                return
            result = {"date": today, "finished_at": now.isoformat(), "verified": False}
            try:
                directory = self._directory(schedule.directory)
                directory.mkdir(mode=0o700, parents=True, exist_ok=True)
                path = directory / f"mashina-auto-{today}.zip"
                descriptor, temporary = tempfile.mkstemp(prefix=".mashina-auto-", dir=directory)
                os.close(descriptor)
                try:
                    save_backup(self.store, temporary)
                    verify_scheduled_archive(temporary)
                    os.replace(temporary, path)
                finally:
                    Path(temporary).unlink(missing_ok=True)
                result["verified"] = True
                result["size"] = path.stat().st_size
                result["finished_at"] = datetime.now(timezone.utc).isoformat()
                data["last_verified"] = result.copy()
                archives = sorted(
                    (item for item in directory.iterdir() if item.is_file() and not item.is_symlink()
                     and re.fullmatch(r"mashina-auto-\d{4}-\d{2}-\d{2}\.zip", item.name)),
                    reverse=True,
                )
                for old in archives[schedule.keep:]:
                    try:
                        old.unlink()
                    except OSError:
                        logging.getLogger(__name__).warning("Scheduled backup retention could not finish")
                        break
            except (OSError, ValueError, BadZipFile):
                logging.getLogger(__name__).warning("Scheduled backup did not pass verification")
            data["last_run"] = result
            self._write(data)

    async def run(self, stopped):
        while not stopped.is_set():
            try:
                await asyncio.to_thread(self.tick)
            except (ValueError, OSError):
                logging.getLogger(__name__).warning("Scheduled backup configuration is unavailable")
            try:
                await asyncio.wait_for(stopped.wait(), timeout=60)
            except TimeoutError:
                pass


def install_scheduled_backups(app, session, scheduled):
    def admin(s):
        with s["store"].transaction() as connection:
            require_admin(s, connection)

    @app.get("/api/v1/admin/backup-schedule")
    def backup_schedule(s=Depends(session)):
        admin(s)
        return scheduled.read()

    @app.put("/api/v1/admin/backup-schedule")
    def update_backup_schedule(body: BackupSchedule, s=Depends(session)):
        admin(s)
        return scheduled.configure(body)
