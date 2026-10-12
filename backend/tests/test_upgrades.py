"""Real released migration paths, preserving data and recovery under failures."""

import hashlib
import json
from pathlib import Path
import sqlite3
import uuid
import zipfile

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine

from backend.storage import Store
from backend.backup import make_backup, restore_backup
from backend.tests.test_api import mutate


@pytest.mark.parametrize("revision", ["001", "002", "003", "004", "005", "006", "007"])
def test_upgrade_each_released_schema_preserves_history_settings_files_and_receipts(
    tmp_path, revision
):
    # Build the actual frozen revision, not a current DB relabelled as an old one.
    path = tmp_path / "installation"
    path.mkdir()
    engine = create_engine(f"sqlite:///{(path / 'mashina.db').as_posix()}")
    owner, car, entry, attachment, operation = [str(uuid.uuid4()) for _ in range(5)]
    image = b"synthetic preserved file"
    filename = attachment + ".bin"
    settings = json.dumps({"locale": "en", "theme": "light", "last_vehicle": car})
    event = json.dumps(
        {
            "kind": "expense",
            "amount_minor": 123456,
            "currency": "RUB",
            "occurred_at": "2026-01-02",
            "odometer": 10100,
            "description": "Preserved",
        }
    )
    with engine.begin() as c:
        cfg = Config()
        cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
        cfg.attributes["connection"] = c
        command.upgrade(cfg, revision)
        c.exec_driver_sql(
            "INSERT INTO users(id,username,password_hash,settings) VALUES(?,?,?,?)",
            (owner, "old-owner", "unchanged-password-hash", settings),
        )
        if revision not in {"001", "002"}:
            c.exec_driver_sql("UPDATE users SET is_admin=1 WHERE id=?", (owner,))
        c.exec_driver_sql(
            "INSERT INTO vehicles(id,owner_id,version,data) VALUES(?,?,1,?)",
            (car, owner, json.dumps({"name": "Existing car", "purchase_odometer": 10000})),
        )
        columns = ",created_by" if revision not in {"001", "002"} else ""
        values = ",?" if columns else ""
        author = (owner,) if columns else ()
        c.exec_driver_sql(
            f"INSERT INTO events(id,owner_id,version,data,vehicle_id{columns}) VALUES(?,?,1,?,?{values})",
            (entry, owner, event, car, *author),
        )
        c.exec_driver_sql(
            f"INSERT INTO attachments(id,owner_id,vehicle_id,event_id,filename,data{columns}) VALUES(?,?,?,?,?,?{values})",
            (
                attachment,
                owner,
                car,
                entry,
                filename,
                json.dumps(
                    {
                        "title": "Preserved file",
                        "sha256": hashlib.sha256(image).hexdigest(),
                        "media_type": "image/png",
                    }
                ),
                *author,
            ),
        )
        c.exec_driver_sql(
            "INSERT INTO receipts VALUES(?,?,?,?)",
            (owner, operation, "hash", '{"record":{"kept":true}}'),
        )
    engine.dispose()
    (path / "uploads").mkdir()
    (path / "uploads" / filename).write_bytes(image)

    store = Store(path)
    assert store.query("SELECT version_num FROM alembic_version")[0]["version_num"] == "007"
    assert store.state(owner)["settings"] == json.loads(settings)
    assert store.state(owner)["events"][0]["amount_minor"] == 123456
    assert store.state(owner)["events"][0]["created_by"] == owner
    assert store.state(owner)["vehicles"][0]["current_odometer"] == 10100
    assert store.query("SELECT password_hash,is_admin FROM users")[0] == {
        "password_hash": "unchanged-password-hash",
        "is_admin": 1,
    }
    assert (store.uploads / filename).read_bytes() == image
    assert store.query("SELECT operation_id,response FROM receipts")[0] == {
        "operation_id": operation,
        "response": '{"record":{"kept":true}}',
    }
    snapshots = list((path / "upgrades").glob("*.zip"))
    assert len(snapshots) == (0 if revision == "007" else 1)
    if snapshots:
        with zipfile.ZipFile(snapshots[0]) as archive:
            assert archive.read("uploads/" + filename) == image
            old = tmp_path / "snapshot.sqlite"
            old.write_bytes(archive.read("database.sqlite"))
        with sqlite3.connect(old) as c:
            assert c.execute("SELECT version_num FROM alembic_version").fetchone()[0] == revision
    store.close()
    restarted = Store(path)
    assert restarted.state(owner)["events"][0]["id"] == entry
    assert len(list((path / "upgrades").glob("*.zip"))) == len(snapshots)
    restarted.close()


def test_newer_schema_refused_without_modifying_history(client):
    store = client.app.state.store
    car = mutate(client, "vehicle", {"name": "Keep newer history"}).json()["record"]
    with store.transaction() as c:
        c.exec_driver_sql("UPDATE alembic_version SET version_num='999'")
    with pytest.raises(RuntimeError, match="newer or unsupported"):
        Store(store.path)
    assert store.query("SELECT version_num FROM alembic_version")[0]["version_num"] == "999"
    assert store.query("SELECT id FROM vehicles")[0]["id"] == car["id"]
    assert not (store.path / "upgrades").exists()


def test_restore_stages_inside_data_volume(client, monkeypatch):
    import tempfile
    import backend.backup as backup

    store = client.app.state.store
    archive = make_backup(store)
    original = tempfile.TemporaryDirectory

    def confined(*args, **kwargs):
        assert Path(kwargs["dir"]).resolve() == store.path.resolve()
        return original(*args, **kwargs)

    monkeypatch.setattr(backup.tempfile, "TemporaryDirectory", confined)
    restore_backup(store, archive)
    assert store.query("SELECT username FROM users")[0]["username"] == "owner"


@pytest.mark.parametrize("failure", [1, 2, 3, 4])
def test_restore_recovers_if_any_initial_file_swap_fails(client, monkeypatch, failure):
    import backend.backup as backup

    store = client.app.state.store
    car = mutate(client, "vehicle", {"name": "Keep live"}).json()["record"]
    sentinel = store.uploads / "preserve.bin"
    sentinel.write_bytes(b"keep")
    archive = make_backup(store)
    original, calls = backup.os.replace, 0

    def fail_once(source, target):
        nonlocal calls
        calls += 1
        if calls == failure:
            raise OSError("simulated file swap failure")
        return original(source, target)

    monkeypatch.setattr(backup.os, "replace", fail_once)
    with pytest.raises(OSError, match="simulated"):
        restore_backup(store, archive)
    assert store.query("SELECT id FROM vehicles")[0]["id"] == car["id"]
    assert sentinel.read_bytes() == b"keep"


def test_failed_upgrade_keeps_complete_pre_migration_snapshot(tmp_path, monkeypatch):
    path = tmp_path / "old"
    path.mkdir()
    engine = create_engine(f"sqlite:///{(path / 'mashina.db').as_posix()}")
    with engine.begin() as c:
        cfg = Config()
        cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
        cfg.attributes["connection"] = c
        command.upgrade(cfg, "001")
        c.exec_driver_sql(
            "INSERT INTO users(id,username,password_hash) VALUES('owner','keep','!no-login')"
        )
    engine.dispose()

    def fail(cfg, revision):
        cfg.attributes["connection"].exec_driver_sql("CREATE TABLE interrupted(value TEXT)")
        raise RuntimeError("simulated migration failure")

    with monkeypatch.context() as patch:
        patch.setattr(command, "upgrade", fail)
        with pytest.raises(RuntimeError, match="simulated migration"):
            Store(path)
    archives = list((path / "upgrades").glob("*.zip"))
    assert len(archives) == 1
    recovered = Store(tmp_path / "recovered")
    restore_backup(recovered, archives[0].read_bytes())
    assert recovered.query("SELECT username FROM users")[0]["username"] == "keep"
    assert recovered.query("SELECT name FROM sqlite_master WHERE name='interrupted'") == []
    recovered.close()
