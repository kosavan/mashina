"""Validate the public site's metadata, links, sitemap and packaged file boundary."""

from html.parser import HTMLParser
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
BASE = "https://kosavan.github.io/mashina/"


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
        if tag in ("a", "link", "img"):
            self.links.append(attrs.get("href", attrs.get("src", "")))
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


page = Page()
page.feed((SITE / "index.html").read_text(encoding="utf-8"))
assert page.canonical == BASE and page.description and page.robots
schema = json.loads(page.schema)
assert schema["@type"] == "SoftwareApplication" and schema["url"] == BASE
assert schema["license"].endswith("/LICENSE")
assert "aggregateRating" not in schema and "review" not in schema
for link in page.links:
    if link.startswith("https://"):
        continue
    if link.startswith("#"):
        assert link[1:] in page.ids, link
    elif link == "assets/mashina-overview.png":
        assert (ROOT / "docs/assets/en/mashina-overview.png").is_file()
    else:
        assert (SITE / link).exists(), link
tree = ET.parse(SITE / "sitemap.xml")
assert [node.text for node in tree.findall(".//{*}loc")] == [BASE]
output = ROOT / "dist-site"
if output.exists():
    actual = {p.relative_to(output).as_posix() for p in output.rglob("*") if p.is_file()}
    assert actual == {"index.html", "style.css", "sitemap.xml", ".nojekyll", "assets/mashina-overview.png"}
print("Site metadata, structured data, local links, sitemap and public file boundary passed.")
