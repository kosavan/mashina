"""Validate the public site's metadata, links, sitemap and packaged file boundary."""

from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
BASE = "https://kosavan.github.io/mashina/"
PAGES = {
    "index.html": "",
    "car-cost.html": "car-cost.html",
    "stoimost-vladeniya.html": "stoimost-vladeniya.html",
}
PUBLIC_ASSETS = {
    "assets/mashina-overview.png": "en/mashina-overview.png",
    "assets/car-cost-analytics.png": "en/analytics.png",
    "assets/car-cost-analytics-ru.png": "ru/analytics.png",
    "assets/fill-up-demo.mp4": "en/fill-up-demo.mp4",
    "assets/fill-up-demo.webp": "en/fill-up-demo.webp",
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
        self.canonical = None
        self.schema = ""
        self.in_schema = False
        self.description = False
        self.robots = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag in ("a", "link", "img", "video", "source"):
            self.links.append(attrs.get("href", attrs.get("src", "")))
        if tag == "video" and "poster" in attrs:
            self.links.append(attrs["poster"])
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        if tag == "meta" and attrs.get("name") == "description":
            self.description = bool(attrs.get("content"))
        if tag == "meta" and attrs.get("name") == "robots":
            self.robots = attrs.get("content") == "index,follow,max-image-preview:large"
        if tag == "script":
            assert attrs.get("type") == "application/ld+json", "No runtime scripts needed"
            self.in_schema = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_schema = False

    def handle_data(self, data):
        if self.in_schema:
            self.schema += data


pages = {}
for filename, location in PAGES.items():
    page = Page()
    page.feed((SITE / filename).read_text(encoding="utf-8"))
    assert page.canonical == BASE + location and page.description and page.robots, filename
    pages[filename] = page
schema = json.loads(pages["index.html"].schema)
assert schema["@type"] == "SoftwareApplication" and schema["url"] == BASE
assert schema["license"].endswith("/LICENSE")
assert "aggregateRating" not in schema and "review" not in schema
for filename, page in pages.items():
    for link in page.links:
        if link.startswith("https://"):
            continue
        url = urlsplit(link)
        target = "index.html" if url.path == "./" else url.path or filename
        if target in PUBLIC_ASSETS:
            assert (ROOT / "docs/assets" / PUBLIC_ASSETS[target]).is_file(), link
        elif target in pages:
            assert not url.fragment or url.fragment in pages[target].ids, link
        else:
            assert target == "style.css" and (SITE / target).is_file(), link
tree = ET.parse(SITE / "sitemap.xml")
assert [node.text for node in tree.findall(".//{*}loc")] == [BASE + path for path in PAGES.values()]
output = ROOT / "dist-site"
if output.exists():
    actual = {p.relative_to(output).as_posix() for p in output.rglob("*") if p.is_file()}
    assert actual == {*PAGES, "style.css", "sitemap.xml", ".nojekyll", *PUBLIC_ASSETS}
print("Site metadata, structured data, local links, sitemap and public file boundary passed.")
