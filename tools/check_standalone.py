"""Smoke-test an extracted Docker-free archive with throwaway application data."""

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import tomllib
from urllib.request import Request, urlopen
from zipfile import ZipFile


def request(url, path, body=None):
    req = Request(url + path, data=body, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=2) as response:
        return response.read()


@contextmanager
def running(args, cwd, url):
    with subprocess.Popen(args, cwd=cwd) as server:
        try:
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError(f"Server exited with {server.returncode}")
                try:
                    request(url, "/api/v1/health")
                except OSError:
                    time.sleep(0.2)
                else:
                    break
            else:
                raise RuntimeError("Server never became ready")
            yield
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()


def check(archive):
    with TemporaryDirectory(prefix="MASHINA portable test ") as work:
        path = Path(work)
        with ZipFile(archive) as bundle:
            bundle.extractall(path)
        root, = path.iterdir()
        script = root / "tools" / "standalone.py"
        data = path / "database and uploads"
        backup_dir = path / "backup snapshots"
        subprocess.run([sys.executable, script, "prepare"], cwd=root, check=True)
        launcher = "Scripts/python.exe" if os.name == "nt" else "bin/python"
        python = root / ".cache" / "standalone" / launcher
        command = [python, "-I", script]
        options = ["--data-dir", data]
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        url = f"http://127.0.0.1:{port}"
        serve = [*command, "serve", *options, "--port", str(port)]
        version = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
        subprocess.run([*command, "admin", *options, "bootstrap"], cwd=root, check=True)
        with running(serve, root, url):
            assert json.loads(request(url, "/api/v1/health"))["version"] == version
            assert b'<div id="root"' in request(url, "/")
            assert json.loads(request(url, "/api/v1/setup"))["required"] is True
            credentials = json.dumps({
                "username": "standalone-smoke",
                "password": secrets.token_urlsafe(24),
                "bootstrap_token": (data / ".bootstrap-token").read_text(encoding="utf-8"),
            }).encode()
            request(url, "/api/v1/setup", credentials)
            assert json.loads(request(url, "/api/v1/setup"))["required"] is False
        subprocess.run(
            [*command, "admin", *options, "backup", "--backup-dir", backup_dir],
            cwd=root, check=True,
        )
        snapshot, = backup_dir.glob("mashina-*.zip")
        fresh = path / "restored database"
        subprocess.run(
            [*command, "admin", "--data-dir", fresh, "restore", "--file", snapshot],
            cwd=root, check=True,
        )
        with running([*command, "serve", "--data-dir", fresh, "--port", str(port)], root, url):
            assert json.loads(request(url, "/api/v1/setup"))["required"] is False
    print("Standalone archive boot, private setup, backup and restore passed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    check(parser.parse_args().archive.resolve())
