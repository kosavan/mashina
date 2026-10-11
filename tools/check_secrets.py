"""Check tracked source for high-confidence credentials; never print secret values."""
from pathlib import Path
import re
import subprocess
import sys

PATTERNS = [
    rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    rb"\bgh[pousr]_[A-Za-z0-9]{30,}\b",
    rb"\bgithub_pat_[A-Za-z0-9_]{30,}\b",
    rb"\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b",
    rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b",
    rb"\bAKIA[0-9A-Z]{16}\b",
]
forbidden = {".env", ".bootstrap-token", "mashina.db", "pre-restore.zip"}
files = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
failed = []
for name in filter(None, files):
    path = Path(name)
    if path.name in forbidden or any(p in {"data", "backups", ".cache", ".venv", "node_modules"} for p in path.parts):
        failed.append(name)
        continue
    if path.is_file() and any(re.search(pattern, path.read_bytes()) for pattern in PATTERNS):
        failed.append(name)
if failed:
    print("Refusing publication: suspicious tracked files:")
    print("\n".join(sorted(set(failed))))
    sys.exit(1)
print(f"Credential/runtime scan passed for {len(list(filter(None, files)))} tracked files.")
