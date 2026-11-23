"""Install and run MASHINA as a local, unprivileged background service."""

import argparse
from contextlib import redirect_stderr, redirect_stdout
import json
import os
from pathlib import Path
import plistlib
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
import traceback
from urllib.error import URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = Path(__file__).resolve()
VENV = ROOT / ".cache" / "standalone"
WINDOWS = sys.platform == "win32"
MACOS = sys.platform == "darwin"
PYTHON = VENV / ("Scripts/python.exe" if WINDOWS else "bin/python")
FRONTEND = ROOT / "frontend" / "dist" / "index.html"
LABEL = "io.github.kosavan.mashina"


def default_data():
    if WINDOWS:
        return Path(os.environ["LOCALAPPDATA"]) / "MASHINA" / "data"
    if MACOS:
        return Path.home() / "Library" / "Application Support" / "MASHINA" / "data"
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share") / "mashina" / "data"


def command(*args, check=True, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=check, **kwargs)


def require_sqlite():
    if sqlite3.sqlite_version_info < (3, 51, 3):
        raise RuntimeError(
            f"SQLite 3.51.3+ is required for persistent data, found {sqlite3.sqlite_version}. "
            "Update uv and run 'uv python install 3.14 --upgrade', then retry."
        )


def prepare():
    if not FRONTEND.is_file():
        raise RuntimeError(
            "The frontend build is missing. Use the standalone release archive or run "
            "'npm ci' and 'npm run build' in frontend/."
        )
    uv = shutil.which("uv")
    if not uv:
        raise RuntimeError("Install uv and make it available on PATH.")
    command(
        uv, "sync", "--frozen", "--no-dev", "--managed-python", "--python", "3.14",
        env={**os.environ, "UV_PROJECT_ENVIRONMENT": str(VENV)},
    )
    command(PYTHON, SCRIPT, "check-runtime")


def path_for_ocr():
    # Login scripts and shell PATH generally are not loaded by a service manager.
    directories = [
        str(Path(binary).parent)
        for utility in ("tesseract", "pdftoppm")
        if (binary := shutil.which(utility))
    ]
    if MACOS:
        directories.extend(["/opt/homebrew/bin", "/usr/local/bin"])
    return os.pathsep.join(dict.fromkeys(directories))


def service_args(data, port):
    python = PYTHON.with_name("pythonw.exe") if WINDOWS else PYTHON
    return [
        str(python), "-I", str(SCRIPT), "serve", "--background", "--data-dir", str(data),
        "--port", str(port), "--ocr-path", path_for_ocr(),
    ]


def systemd_arg(value):
    if any(character in value for character in ("\n", "\r")):
        raise RuntimeError("The installation path must be on one line.")
    value = value.replace("%", "%%").replace("$", "$$")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_service_file(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(content)


def linux_service(action, data, port):
    unit = "mashina.service"
    config = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config")
    path = config / "systemd" / "user" / unit
    if action != "install" and not path.is_file():
        raise RuntimeError("MASHINA's user service is missing.")
    if action == "install":
        executable = " ".join(map(systemd_arg, service_args(data, port)))
        write_service_file(path, (
            "[Unit]\nDescription=MASHINA local server\n\n"
            "[Service]\n"
            f"ExecStart={executable}\n"
            "Restart=on-failure\nRestartSec=5s\n"
            "NoNewPrivileges=true\nUMask=0077\n\n"
            "[Install]\nWantedBy=default.target\n"
        ).encode("utf-8"))
        try:
            command("systemctl", "--user", "daemon-reload")
            command("systemctl", "--user", "enable", "--now", unit)
        except subprocess.CalledProcessError:
            command("systemctl", "--user", "disable", "--now", unit, check=False)
            path.unlink()
            command("systemctl", "--user", "daemon-reload", check=False)
            raise
    elif action == "uninstall":
        command("systemctl", "--user", "disable", "--now", unit)
        path.unlink()
        command("systemctl", "--user", "daemon-reload")
    else:
        command("systemctl", "--user", action, unit)


def macos_service(action, data, port):
    domain = f"gui/{os.getuid()}"
    job = f"{domain}/{LABEL}"
    path = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
    if action == "install":
        write_service_file(path, plistlib.dumps({
            "Label": LABEL,
            "ProgramArguments": service_args(data, port),
            "RunAtLoad": True,
            "KeepAlive": {"SuccessfulExit": False},
            "ThrottleInterval": 10,
            "Umask": 0o077,
            "StandardOutPath": str(data / "server.log"),
            "StandardErrorPath": str(data / "server.log"),
        }))
        try:
            command("/bin/launchctl", "bootstrap", domain, path)
        except subprocess.CalledProcessError:
            path.unlink()
            raise
    elif action == "start":
        command("/bin/launchctl", "bootstrap", domain, path)
    elif action in ("stop", "uninstall"):
        loaded = command("/bin/launchctl", "print", job, check=False, capture_output=True)
        if loaded.returncode == 0:
            command("/bin/launchctl", "bootout", job)
        if action == "uninstall":
            path.unlink()
    else:
        command("/bin/launchctl", "print", job)


def windows_service(action, data, port):
    setup = r"""
$ErrorActionPreference = 'Stop'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$name = "MASHINA-$($identity.User.Value)"
$task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
"""
    scripts = {
        "install": r"""
if ($task) { throw 'The task already exists. Uninstall it before installing another version.' }
$action = New-ScheduledTaskAction -Execute $env:MASHINA_TASK_EXE -Argument $env:MASHINA_TASK_ARGS
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Description 'MASHINA local server' `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
try { Start-ScheduledTask -TaskName $name }
catch {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    throw
}
""",
        "start": "Start-ScheduledTask -TaskName $name",
        "stop": "if (!$task) { throw 'Task is missing.' }; Stop-ScheduledTask -TaskName $name",
        "status": "if (!$task) { throw 'Task is missing.' }; $task | Select-Object TaskName,State",
        "uninstall": r"""
if (!$task) { throw 'Task is missing.' }
if ($task.State -eq 'Running') { Stop-ScheduledTask -TaskName $name }
Unregister-ScheduledTask -TaskName $name -Confirm:$false
""",
    }
    executable, *args = service_args(data, port)
    if action == "install" and not Path(executable).is_file():
        raise RuntimeError("Managed Python's windowless launcher (pythonw.exe) is missing.")
    command(
        "powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
        setup + scripts[action],
        env={
            **os.environ, "MASHINA_TASK_EXE": executable,
            "MASHINA_TASK_ARGS": subprocess.list2cmdline(args),
        },
    )


def server_socket(port):
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if WINDOWS:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind(("127.0.0.1", port))
    except OSError:
        listener.close()
        raise
    return listener


def use_data(data, ocr_path=""):
    require_sqlite()
    if os.name == "posix":
        os.umask(0o077)
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT))
    os.environ.update(MASHINA_DATA=str(data), MASHINA_PRODUCTION="1")
    if ocr_path:
        os.environ["PATH"] = ocr_path + os.pathsep + os.environ.get("PATH", os.defpath)


def serve(data, port, ocr_path):
    use_data(data, ocr_path)
    if not FRONTEND.is_file():
        raise RuntimeError("Frontend build is missing.")
    from filelock import FileLock
    import uvicorn

    data.mkdir(parents=True, exist_ok=True)
    with FileLock(data / ".standalone.lock", timeout=0), server_socket(port) as listener:
        config = uvicorn.Config(
            "backend.app:app", host="127.0.0.1", port=port,
            proxy_headers=False, access_log=False,
        )
        server = uvicorn.Server(config)
        server.run(sockets=[listener])
        if not server.started:
            raise RuntimeError("MASHINA did not start.")


def wait_for_server(port):
    url = f"http://127.0.0.1:{port}/api/v1/health"
    for _ in range(30):
        try:
            with urlopen(url, timeout=1) as response:
                if json.load(response).get("status") == "ok":
                    print(f"MASHINA is ready at http://127.0.0.1:{port}/")
                    return
        except (OSError, URLError, ValueError):
            pass
        time.sleep(1)
    raise RuntimeError("The service did not become healthy. See service status and logs.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument(
        "action", choices=[
            "prepare", "install", "start", "stop", "status", "uninstall", "serve", "admin",
            "check-runtime",
        ],
    )
    parser.add_argument("--data-dir", type=Path, default=default_data())
    parser.add_argument("--port", type=int, choices=range(1024, 65536), metavar="1024-65535", default=8000)
    parser.add_argument("--background", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--ocr-path", default="", help=argparse.SUPPRESS)
    options, extra = parser.parse_known_args()
    if extra and options.action != "admin":
        parser.error("unrecognized arguments: " + " ".join(extra))
    data = options.data_dir.expanduser().resolve()
    if "?" in str(data):
        parser.error("The data path cannot contain a question mark.")
    action = options.action
    if action == "check-runtime":
        require_sqlite()
        print(f"Ready with SQLite {sqlite3.sqlite_version}")
    elif action == "prepare":
        prepare()
    elif action == "serve":
        if WINDOWS and options.background:
            with (data / "server.log").open("a", encoding="utf-8", buffering=1) as log:
                with redirect_stdout(log), redirect_stderr(log):
                    try:
                        serve(data, options.port, options.ocr_path)
                    except Exception:
                        traceback.print_exc()
                        return 1
        else:
            serve(data, options.port, options.ocr_path)
    elif action == "admin":
        if sys.prefix != str(VENV):
            command(PYTHON, "-I", SCRIPT, *sys.argv[1:])
        else:
            use_data(data)
            from filelock import FileLock

            if any(arg == "--data" or arg.startswith("--data=") for arg in extra):
                parser.error("Use --data-dir to select the data directory.")
            data.mkdir(parents=True, exist_ok=True)
            with FileLock(data / ".standalone.lock", timeout=0):
                from backend.cli import main as admin

                sys.argv[1:] = extra
                admin()
    else:
        manager = (
            windows_service if WINDOWS else macos_service if MACOS
            else linux_service if sys.platform.startswith("linux") else None
        )
        if manager is None:
            parser.error("Background installation supports Windows, macOS and Linux with systemd.")
        if action == "install":
            with server_socket(options.port):
                pass
            prepare()
            data.mkdir(parents=True, exist_ok=True, mode=0o700)
        manager(action, data, options.port)
        if action == "install":
            print(f"Data directory: {data}")
            wait_for_server(options.port)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(f"MASHINA: {error}")
