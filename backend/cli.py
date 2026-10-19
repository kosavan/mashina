"""Local-only administration; never prints passwords or bootstrap secrets."""

import argparse
from contextlib import ExitStack
from datetime import datetime
import getpass
import json
import os
from pathlib import Path
import secrets
import uuid
from backend.storage import Store
from backend.backup import save_backup, restore_backup


def main():
    parser = argparse.ArgumentParser(description="MASHINA administration")
    parser.add_argument(
        "command",
        choices=[
            "bootstrap",
            "create-admin",
            "backup",
            "restore",
            "notification-keys",
            "notification-resume",
            "notifications-dispatch",
        ],
    )
    parser.add_argument("--data", default=os.getenv("MASHINA_DATA", "data"))
    parser.add_argument("--file")
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--keep", type=int, default=int(os.getenv("MASHINA_BACKUP_KEEP", "7")))
    parser.add_argument(
        "--send", action="store_true", help="Explicitly allow outbound notification requests"
    )
    parser.add_argument(
        "--receive-links",
        action="store_true",
        help="Receive private Telegram linking codes; requires --send",
    )
    args = parser.parse_args()
    if args.receive_links and (not args.send or args.command != "notifications-dispatch"):
        parser.error("--receive-links requires notifications-dispatch --send")
    stack = ExitStack()
    if args.command == "notifications-dispatch":
        from backend.notifications import notification_guard

        try:
            stack.enter_context(notification_guard(args.data))
        except ValueError as exc:
            parser.error(str(exc))
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
            save_backup(store, target)
            target.chmod(0o600)
            for old in sorted(directory.glob("mashina-*.zip"), reverse=True)[args.keep :]:
                old.unlink()
            print(f"Backup saved: {target.resolve()}. Copy to a different physical disk.")
        elif args.command == "notification-keys":
            from backend.notifications import initialize_identity

            initialize_identity(store)
            print(
                "Web Push identity initialized locally. Public key is available in notification settings."
            )
        elif args.command == "notification-resume":
            with store.transaction() as c:
                c.exec_driver_sql("UPDATE notification_identity SET paused=0")
            print("Server notification pause removed. Each user must enable their own channels.")
        elif args.command == "notifications-dispatch":
            from backend.notification_delivery import dispatch, receive_telegram_links

            linked = receive_telegram_links(store) if args.receive_links else 0
            print(
                json.dumps(
                    {"linked": linked, "dry_run": not args.send, **dispatch(store, send=args.send)}
                )
            )
        else:
            if not args.file:
                parser.error("--file is required; stop the app before CLI restore")
            restore_backup(store, Path(args.file))
            print("Restore verified and applied. Sessions invalidated.")
    except ValueError as exc:
        parser.error(str(exc))
    finally:
        store.close()
        stack.close()


if __name__ == "__main__":
    main()
