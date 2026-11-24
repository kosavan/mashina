"""Build an explicit public-file allowlist; never publish the repository tree."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist-site"
OUTPUT.mkdir(exist_ok=True)
if any(OUTPUT.iterdir()):
    raise SystemExit("dist-site must be empty: use a fresh build directory.")
for name in ("index.html", "car-cost.html", "stoimost-vladeniya.html", "style.css", "sitemap.xml", ".nojekyll"):
    shutil.copyfile(ROOT / "site" / name, OUTPUT / name)
(OUTPUT / "assets").mkdir()
for source, filename in (
    ("en/mashina-overview.png", "mashina-overview.png"),
    ("en/analytics.png", "car-cost-analytics.png"),
    ("ru/analytics.png", "car-cost-analytics-ru.png"),
    ("en/fill-up-demo.mp4", "fill-up-demo.mp4"),
    ("en/fill-up-demo.webp", "fill-up-demo.webp"),
):
    shutil.copyfile(ROOT / "docs/assets" / source, OUTPUT / "assets" / filename)
print("Built the allowlisted public site in dist-site.")
