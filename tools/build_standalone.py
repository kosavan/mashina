"""Pack the prebuilt frontend and tracked server files into a standalone release ZIP."""

import argparse
from pathlib import Path
import subprocess
import tomllib
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]


def build(output):
    frontend = ROOT / "frontend" / "dist"
    if not (frontend / "index.html").is_file():
        raise SystemExit("Run 'npm run build' in frontend/ first.")
    version = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
    directory = f"mashina-{version}"
    backend = subprocess.check_output(["git", "ls-files", "-z", "backend"], cwd=ROOT)
    paths = [
        ROOT / name
        for name in backend.decode().split("\0")
        if name and not name.startswith("backend/tests/")
    ]
    paths += [
        ROOT / name for name in (
            "LICENSE", "pyproject.toml", "uv.lock", "tools/standalone.py",
            "docs/standalone.md", "docs/standalone.ru.md",
        )
    ]
    paths += sorted(path for path in frontend.rglob("*") if path.is_file())
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for path in paths:
            if path.is_symlink():
                raise SystemExit(f"Refusing to package symlink: {path.relative_to(ROOT)}")
            archive.write(path, f"{directory}/{path.relative_to(ROOT).as_posix()}")
    print(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    build(parser.parse_args().output)
