"""Rebuild Fold M SVGs and optional web icons from local, licensed geometry.

SVG generation needs only Python. Pass --web-icons to rasterize PNG/ICO through
an installed Chromium browser (or set CHROME_PATH). No network or runtime
application dependency is used. The historical c1ee79 files remain unchanged.
"""

import argparse
import os
from pathlib import Path
import json
import shutil
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET

folder = Path(__file__).resolve().parents[1] / "design/identity"
masters = folder / "masters"
exports = folder / "exports"
mark = (
    ET.parse(folder / "dusk-concepts/a-fold-v2.svg")
    .getroot()
    .find("{http://www.w3.org/2000/svg}path")
    .attrib["d"]
)
geometry = json.loads((folder / "wordmark-geometry.json").read_text())
paths = "".join(f'<path d="{d}"/>' for d in geometry["paths"])
peri, slate, bone, ink, word = "#B9B5F4", "#11141C", "#F1EEEB", "#292C3C", "#F3F0ED"


def symbol(color):
    return f'<path fill="{color}" d="{mark}"/>'


def letters(color, transform=""):
    return f'<g fill="{color}" transform="{transform}">{paths}</g>'


def horizontal(color, text):
    return symbol(color) + letters(text, "translate(292 64)")


def svg(body, w, h, title="MASHINA Fold M"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="title"><title id="title">{title}</title>{body}</svg>\n'


files = {
    "mashina-symbol.svg": svg(symbol(peri), 256, 256),
    "mashina-symbol-light.svg": svg(symbol(ink), 256, 256),
    "mashina-wordmark.svg": svg(letters(word), 640, 128),
    "mashina-wordmark-light.svg": svg(letters(ink), 640, 128),
    "mashina-horizontal.svg": svg(horizontal(peri, word), 956, 256),
    "mashina-horizontal-light.svg": svg(horizontal(ink, ink), 956, 256),
    "mashina-stacked.svg": svg(
        f'<g transform="translate(192 0)">{symbol(peri)}</g>' + letters(word, "translate(0 272)"),
        640,
        408,
    ),
}
for name, content in files.items():
    (masters / name).write_text(content, encoding="utf-8")
for suffix, bg, fg, text in [("", slate, peri, word), ("-light", bone, ink, ink)]:
    body = f'<rect width="1020" height="320" rx="32" fill="{bg}"/><g transform="translate(32 32)">{horizontal(fg, text)}</g>'
    (exports / f"mashina-header{suffix}.svg").write_text(svg(body, 1020, 320), encoding="utf-8")


def tile(fraction, rounded=False):
    scale = 256 * fraction / 192
    offset = 128 * (1 - scale)
    radius = 57.6 if rounded else 0
    return f'<rect width="256" height="256" rx="{radius:g}" fill="{slate}"/><g transform="translate({offset:.4f} {offset:.4f}) scale({scale:.6f})">{symbol(peri)}</g>'


for suffix, color in [
    ("black", "#000000"),
    ("white", "#FFFFFF"),
    ("mono-b9b5f4", peri),
    ("mono-292c3c", ink),
]:
    (exports / f"mashina-symbol-{suffix}.svg").write_text(
        svg(symbol(color), 256, 256), encoding="utf-8"
    )
    (exports / f"mashina-horizontal-{suffix}.svg").write_text(
        svg(horizontal(color, color), 956, 256), encoding="utf-8"
    )
for name, body in {
    "mashina-symbol-square.svg": f'<g transform="translate(-15.36 -15.36) scale(1.12)">{symbol(peri)}</g>',
    "mashina-symbol-app-icon.svg": tile(0.68, True),
    "mashina-symbol-maskable.svg": tile(0.50),
    "mashina-symbol-favicon.svg": tile(0.90, True),
    "favicon.svg": tile(0.90, True),
}.items():
    (exports / name).write_text(svg(body, 256, 256), encoding="utf-8")
manifest = {
    "name": "MASHINA",
    "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {
            "src": "/maskable-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable",
        },
    ],
    "theme_color": slate,
    "background_color": slate,
    "display": "standalone",
}
(exports / "site.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
(exports / "head-snippet.html").write_text(
    '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n'
    + f'<meta name="theme-color" content="{slate}">\n',
    encoding="utf-8",
)


def browser_path(explicit):
    candidates = [
        explicit,
        os.getenv("CHROME_PATH"),
        shutil.which("chromium"),
        shutil.which("google-chrome"),
        shutil.which("chromium-browser"),
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    found = next((str(p) for p in candidates if p and Path(p).is_file()), None)
    if not found:
        raise SystemExit("Web icons need installed Chromium: set CHROME_PATH or --chrome.")
    return found


def render(browser, body, destination, size):
    with tempfile.TemporaryDirectory(prefix="mashina-brand-") as tmp:
        directory = Path(tmp)
        source = directory / "icon.html"
        output = directory / "icon.png"
        source.write_text(
            f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;width:{size}px;height:{size}px;overflow:clip}}svg{{display:block;width:{size}px;height:{size}px}}</style>'
            + body,
            encoding="utf-8",
        )
        subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
                "--default-background-color=00000000",
                "--force-device-scale-factor=1",
                f"--window-size={size},{size}",
                f"--screenshot={output}",
                f"--user-data-dir={directory / 'profile'}",
                source.as_uri(),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=45,
        )
        if not output.is_file():
            raise RuntimeError(f"Chromium did not render {destination.name}")
        shutil.copyfile(output, destination)


def web_icons(browser):
    for name, size, body in [
        ("favicon-16.png", 16, tile(0.90, True)),
        ("favicon-32.png", 32, tile(0.90, True)),
        ("favicon-48.png", 48, tile(0.90, True)),
        ("apple-touch-icon.png", 180, tile(0.68)),
        ("icon-192.png", 192, tile(0.68)),
        ("icon-512.png", 512, tile(0.68)),
        ("maskable-512.png", 512, tile(0.50)),
    ]:
        render(browser, svg(body, 256, 256), exports / name, size)
    images = [(size, (exports / f"favicon-{size}.png").read_bytes()) for size in (16, 32, 48)]
    offset = 6 + 16 * len(images)
    entries, payload = [], []
    for size, data in images:
        entries.append(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(data), offset))
        payload.append(data)
        offset += len(data)
    (exports / "favicon.ico").write_bytes(
        struct.pack("<HHH", 0, 1, len(images)) + b"".join(entries + payload)
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--web-icons", action="store_true", help="also rasterize local PNG/ICO icons"
    )
    parser.add_argument("--chrome", help="path to installed Chromium browser")
    args = parser.parse_args()
    if args.web_icons:
        web_icons(browser_path(args.chrome))
    print(
        "MASHINA Fold M masters and variants generated"
        + (" with PNG/ICO icons." if args.web_icons else ".")
    )
