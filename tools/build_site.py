"""Build an explicit public-file allowlist; never publish the repository tree."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist-site"
OUTPUT.mkdir(exist_ok=True)
if any(OUTPUT.iterdir()):
    raise SystemExit("dist-site must be empty: use a fresh build directory.")
for name in ("index.html", "style.css", "sitemap.xml", ".nojekyll"):
    shutil.copyfile(ROOT / "site" / name, OUTPUT / name)
(OUTPUT / "assets").mkdir()
shutil.copyfile(
    ROOT / "docs/assets/en/mashina-overview.png",
    OUTPUT / "assets/mashina-overview.png",
)
print("Built static public site in dist-site (5 allowlisted files).")
