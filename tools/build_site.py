"""Build an explicit public-file allowlist; never publish the repository tree."""

import argparse
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
# Keep this explicit. Never copy a directory, user data or the repository tree.
PUBLIC_FILES = {
    "index.html": "site/index.html",
    "style.css": "site/style.css",
    "tokens.css": "site/tokens.css",
    "base.css": "site/base.css",
    "sitemap.xml": "site/sitemap.xml",
    ".nojekyll": "site/.nojekyll",
    "assets/mashina-overview.png": "docs/assets/en/mashina-overview.png",
    "assets/garage-cards.png": "design/showcase/assets/garage-en.png",
    "assets/dusk-landscape.webp": "site/assets/dusk-landscape.webp",
    "assets/logo.svg": "site/assets/logo.svg",
    "assets/logo-ink.svg": "site/assets/logo-ink.svg",
    "assets/manrope.woff2": "site/assets/manrope.woff2",
    "assets/manrope-cyrillic.woff2": "site/assets/manrope-cyrillic.woff2",
    "assets/OFL.txt": "site/assets/OFL.txt",
}


def build(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise SystemExit(f"{output} must be empty: use a fresh build directory.")
    for public_name, source_name in PUBLIC_FILES.items():
        target = output / public_name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source_name, target)
    print(f"Built static public site in {output} ({len(PUBLIC_FILES)} allowlisted files).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist-site")
    build(parser.parse_args().output)
