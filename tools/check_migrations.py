"""Protect already released migrations and the frozen initial schema."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "backend/migrations/frozen.json").read_text())
for name, expected in manifest.items():
    content = (ROOT / name).read_bytes().replace(b"\r\n", b"\n")
    if hashlib.sha256(content).hexdigest() != expected:
        raise SystemExit(f"Released migration changed: {name}. Add a new revision instead.")
print(f"Released schema/migration fingerprints verified: {len(manifest)} files.")
