"""Build only the explicit, public site bundle."""
from pathlib import Path
import shutil

from site_guides import PUBLIC_ASSETS, ROOT, SITE, guides, sitemap


def build(output):
    output.mkdir(exist_ok=True)
    if any(output.iterdir()):
        raise SystemExit("dist-site must be empty: use a fresh build directory.")

    pages, _, downloads = guides()
    for filename, html in pages.items():
        dst = output / filename
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(html, encoding="utf-8")
    for filename, content in downloads.items():
        (output / filename).write_text(content, encoding="utf-8-sig", newline="")
    for name in ("style.css", ".nojekyll", "assets/fuel-calculator.js"):
        dst = output / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SITE / name, dst)
    for filename, source in PUBLIC_ASSETS.items():
        shutil.copyfile(ROOT / "docs/assets" / source, output / filename)
    (output / "sitemap.xml").write_text(sitemap(pages), encoding="utf-8")
    print(f"Built {len(pages)} HTML pages and {len(downloads)} CSV templates.")


if __name__ == "__main__":
    build(ROOT / "dist-site")
