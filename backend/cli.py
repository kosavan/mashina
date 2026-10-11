"""Local-only administration; never prints passwords or bootstrap secrets."""

import argparse
from datetime import datetime
import getpass
import os
from pathlib import Path
import secrets
import uuid
from backend.storage import Store
from backend.backup import make_backup, restore_backup


def main():
    parser = argparse.ArgumentParser(description="MASHINA administration")
    parser.add_argument("command", choices=["bootstrap", "create-admin", "backup", "restore"])
    parser.add_argument("--data", default=os.getenv("MASHINA_DATA", "data"))
    parser.add_argument("--file")
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--keep", type=int, default=int(os.getenv("MASHINA_BACKUP_KEEP", "7")))
    args = parser.parse_args()
    store = Store(args.data)
    try:
        if args.command in {"bootstrap", "create-admin"}:
            if store.query("SELECT id FROM users"):
                parser.error("Administrator already exists")
            if args.command == "bootstrap":
                target = store.path / ".bootstrap-token"
                target.write_text(secrets.token_urlsafe(32))
                target.chmod(0o600)
                print(
                    f"One-time token saved locally to {target.resolve()}; keep private and enter in setup."
                )
            else:
                from backend.app import HASHER

                username = input("Username (3-64 characters): ").strip()
                password = getpass.getpass("Password (12+ characters): ")
                if not 3 <= len(username) <= 64 or not 12 <= len(password) <= 256:
                    parser.error("Invalid username/password length")
                if password != getpass.getpass("Confirm password: "):
                    parser.error("Passwords differ")
                with store.transaction() as c:
                    c.exec_driver_sql(
                        "INSERT INTO users(id,username,password_hash,is_admin) VALUES(?,?,?,1)",
                        (str(uuid.uuid4()), username, HASHER.hash(password)),
                    )
                print("Administrator created.")
        elif args.command == "backup":
            if args.keep < 1:
                parser.error("Retention must be at least 1")
            directory = Path(args.backup_dir)
            directory.mkdir(parents=True, exist_ok=True)
            target = directory / f"mashina-{datetime.now():%Y%m%d-%H%M%S-%f}.zip"
            target.write_bytes(make_backup(store))
            target.chmod(0o600)
            for old in sorted(directory.glob("mashina-*.zip"), reverse=True)[args.keep :]:
                old.unlink()
            print(f"Backup saved: {target.resolve()}. Copy to a different physical disk.")
        else:
            if not args.file:
                parser.error("--file is required; stop the app before CLI restore")
            restore_backup(store, Path(args.file).read_bytes())
            print("Restore verified and applied. Sessions invalidated.")
    finally:
        store.close()


if __name__ == "__main__":
    main()
