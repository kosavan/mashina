"""Check guide language links, local resources and the shipped file boundary."""
from html.parser import HTMLParser
import json
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree as ET

from site_guides import BASE, PUBLIC_ASSETS, ROOT, guides, sitemap

FIXED_FILES = {"style.css", "sitemap.xml", ".nojekyll", "assets/fuel-calculator.js"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
        self.alternates = {}
        self.canonical = None
        self.schema = ""
        self.in_schema = False
        self.description = False
        self.robots = False
        self.lang = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, attrs["id"]
            self.ids.add(attrs["id"])
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag in ("a", "link", "img", "video", "source"):
            self.links.append(attrs.get("href", attrs.get("src", "")))
        if tag == "video" and "poster" in attrs:
            self.links.append(attrs["poster"])
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        if tag == "link" and attrs.get("rel") == "alternate":
            code = attrs["hreflang"]
            assert code not in self.alternates, code
            self.alternates[code] = attrs["href"]
        if tag == "meta" and attrs.get("name") == "description":
            self.description = bool(attrs.get("content"))
        if tag == "meta" and attrs.get("name") == "robots":
            self.robots = attrs.get("content") == "index,follow,max-image-preview:large"
        if tag == "script":
            if attrs.get("type") == "application/ld+json":
                self.in_schema = True
            else:
                self.links.append(attrs["src"])
                assert attrs["src"] == "../../assets/fuel-calculator.js"

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_schema = False

    def handle_data(self, data):
        if self.in_schema:
            self.schema += data


def check():
    source, groups, downloads = guides()
    output = ROOT / "dist-site"
    allowed = {*source, *downloads, *PUBLIC_ASSETS, *FIXED_FILES}
    pages = {}
    for filename, html in source.items():
        page = Page()
        page.feed(html)
        location = "" if filename == "index.html" else filename
        assert page.canonical == BASE + location and page.description and page.robots, filename
        alternates = groups[filename]
        expected = {lang: BASE + path for lang, path in alternates.items()}
        if alternates:
            assert alternates[page.lang] == filename, filename
            expected["x-default"] = expected["en"]
        assert page.alternates == expected, filename
        pages[filename] = page

    schema = json.loads(pages["index.html"].schema)
    assert schema["@type"] == "SoftwareApplication" and schema["url"] == BASE
    assert schema["license"].endswith("/LICENSE")
    assert "aggregateRating" not in schema and "review" not in schema

    for filename, page in pages.items():
        for link in page.links:
            assert link, filename
            full_url = urljoin(BASE + filename, link)
            if not full_url.startswith(BASE):
                assert full_url.startswith("https://"), (filename, link)
                continue
            local = urlsplit(full_url[len(BASE):])
            target = local.path or "index.html"
            assert target in allowed, (filename, link)
            if local.fragment:
                assert local.fragment in pages[target].ids, (filename, link)
    for path in PUBLIC_ASSETS.values():
        assert (ROOT / "docs/assets" / path).is_file(), path

    if output.exists():
        actual = {p.relative_to(output).as_posix() for p in output.rglob("*") if p.is_file()}
        assert actual == allowed, (allowed - actual, actual - allowed)
        for name, html in source.items():
            assert (output / name).read_text(encoding="utf-8") == html, name
        for name, content in downloads.items():
            assert (output / name).read_text(encoding="utf-8-sig").splitlines() == content.splitlines(), name
        xml = (output / "sitemap.xml").read_text(encoding="utf-8")
        assert xml == sitemap(source)
        tree = ET.fromstring(xml)
        assert {node.text for node in tree.findall(".//{*}loc")} == {page.canonical for page in pages.values()}
    print(f"Verified canonical URLs, reciprocal language links and asset boundary for {len(pages)} pages.")


if __name__ == "__main__":
    check()
