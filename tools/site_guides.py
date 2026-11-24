"""Render translated guides without a runtime or a build dependency."""
from html import escape
from json import loads
from pathlib import Path
from posixpath import relpath
import csv
import io
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
BASE = "https://kosavan.github.io/mashina/"
REPO = "https://github.com/kosavan/mashina"
LOCALES = ("en", "ru", "de", "fr", "es", "hi", "ar", "zh-Hans")
TOPICS = {
    "fuel": "fuel-consumption-calculator",
    "service": "car-maintenance-schedule",
    "log": "car-maintenance-log-template",
    "cost": "car-running-costs",
    "compare": "self-hosted-lubelogger-alternatives",
    "tires": "tire-pressure-and-history",
}
LEGACY_COST = {"en": "car-cost.html", "ru": "stoimost-vladeniya.html"}
SOURCES = {
    "compare": (
        ("LubeLogger", "https://docs.lubelogger.com/"),
        ("MyGarage", "https://github.com/homelabforge/mygarage"),
        ("Fuelio", "https://www.fuel.io/faq/backup-and-import/"),
        ("Drivvo", "https://www.drivvo.com/en/"),
        ("MASHINA", REPO),
    ),
    "tires": (("NHTSA", "https://www.nhtsa.gov/vehicle-safety/tires"),),
}
PUBLIC_ASSETS = {
    "assets/mashina-overview.png": "en/mashina-overview.png",
    "assets/car-cost-analytics.png": "en/analytics.png",
    "assets/car-cost-analytics-ru.png": "ru/analytics.png",
    "assets/fill-up-demo.mp4": "en/fill-up-demo.mp4",
    "assets/fill-up-demo.webp": "en/fill-up-demo.webp",
}


def article_path(lang, topic):
    if topic == "cost" and lang in LEGACY_COST:
        return LEGACY_COST[lang]
    return f"guides/{lang.lower()}/{TOPICS[topic]}.html"


def index_path(lang):
    return f"guides/{lang.lower()}/index.html"


def csv_path(lang):
    return f"guides/{lang.lower()}/vehicle-logbook.csv"


def local_link(page, target):
    return relpath(target, str(Path(page).parent).replace("\\", "/"))


def alternate_links(paths):
    links = {**paths, "x-default": paths["en"]}
    return "\n  ".join(
        f'<link rel="alternate" hreflang="{lang}" href="{BASE}{path}">'
        for lang, path in links.items()
    )


def language_menu(page, ui, paths, content, current):
    links = " · ".join(
        f'<a lang="{lang}" hreflang="{lang}" href="{local_link(page, target)}"'
        f'{" aria-current=\"page\"" if lang == current else ""}>'
        f'{escape(content[lang]["ui"]["name"])}</a>'
        for lang, target in paths.items()
    )
    return f'<nav class="guide-languages" aria-label="{escape(ui["languages"])}">{links}</nav>'


def document(lang, page, title, description, ui, alternates, menu, body):
    direction = ' dir="rtl"' if lang == "ar" else ""
    return f"""<!doctype html>
<html lang="{lang}"{direction}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{escape(title)} | MASHINA</title>
  <meta name="description" content="{escape(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{BASE}{page}">
  {alternate_links(alternates)}
  <link rel="stylesheet" href="{local_link(page, 'style.css')}">
</head>
<body>
  <a class="skip" href="#main">{escape(ui['skip'])}</a>
  <header>
    <a class="wordmark" href="{local_link(page, 'index.html')}">MASHINA<span aria-hidden="true">●</span></a>
    {menu}
  </header>
  <main id="main"><article class="cost-guide">{body}</article></main>
  <footer><span>MASHINA</span><a href="{local_link(page, index_path(lang))}">{escape(ui['articles'])}</a></footer>
</body>
</html>
"""


def calculator(page, ui):
    def label(key):
        return escape(ui[key])

    script = local_link(page, "assets/fuel-calculator.js")
    return f"""
  <section class="fuel-tool" aria-label="{label('calculate')}" data-fuel-calculator>
    <label for="fuel-distance">{label('distance')}</label>
    <div class="fuel-distance">
      <input id="fuel-distance" type="number" inputmode="decimal" step="any" value="520">
      <select aria-label="{label('distance')}">
        <option value="km">{label('km')}</option>
        <option value="mi">{label('miles')}</option>
      </select>
    </div>
    <label for="fuel-litres">{label('fuel')} ({label('litres')})</label>
    <input id="fuel-litres" type="number" inputmode="decimal" step="any" value="39">
    <button class="button" type="button" hidden>{label('calculate')}</button>
    <output aria-live="polite" data-invalid="{label('invalid')}" dir="auto"></output>
  </section>
  <script src="{script}" defer></script>
"""


def article(lang, topic, content, paths):
    locale = content[lang]
    ui = locale["ui"]
    page = article_path(lang, topic)
    entry = locale["articles"][topic]
    menu = language_menu(page, ui, paths, content, lang)
    related = "".join(
        f'<li><a href="{local_link(page, article_path(lang, key))}">'
        f'{escape(other["title"])}</a></li>'
        for key, other in locale["articles"].items() if key != topic
    )
    if topic == "cost" and lang in LEGACY_COST:
        original = (SITE / page).read_text(encoding="utf-8")
        original = re.sub(r'<link rel="alternate"[^>]+>', alternate_links(paths), original)
        original = re.sub(r"<nav>.*?</nav>", lambda _: menu, original, count=1)
        navigation = f'<h2>{escape(ui["related"])}</h2><ul>{related}</ul>'
        return original.replace('      <div class="actions">', f'      {navigation}\n      <div class="actions">')
    chunks = [
        f'<h1>{escape(entry["title"])}</h1>',
        f'<p class="intro">{escape(entry["description"])}</p>',
    ]
    if topic == "fuel":
        chunks.append(calculator(page, ui))
    if topic == "log":
        chunks.append(f'<p><a class="button" href="{local_link(page, csv_path(lang))}" download>{escape(ui["download"])}</a></p>')
    for part in entry["sections"]:
        chunks.append(f'<h2>{escape(part["heading"])}</h2>')
        chunks.extend(f"<p>{escape(paragraph)}</p>" for paragraph in part["paragraphs"])
    if topic in SOURCES:
        source_links = " · ".join(f'<a href="{url}">{name}</a>' for name, url in SOURCES[topic])
        chunks.append(f'<h2>{escape(ui["sources"])}</h2><p>{source_links}</p>')
    chunks.append(f'<h2>{escape(ui["related"])}</h2><ul>{related}</ul>')
    install = "container-image.ru.md" if lang == "ru" else "container-image.md"
    chunks.append(f'<p><a class="button" href="{REPO}/blob/main/docs/{install}">{escape(ui["install"])}</a></p>')
    chunks.append('<p class="note" lang="en">Vibecoded with love ❤️</p>')
    return document(lang, page, entry["title"], entry["description"], ui, paths, menu, "\n".join(chunks))


def guides():
    content = loads((SITE / "guides.json").read_text(encoding="utf-8"))
    if set(content) != set(LOCALES) or any(set(item["articles"]) != set(TOPICS) for item in content.values()):
        raise ValueError("Every guide topic must have one entry per supported language")
    pages = {"index.html": (SITE / "index.html").read_text(encoding="utf-8")}
    alternates = {"index.html": {}}
    downloads = {}
    indexes = {lang: index_path(lang) for lang in LOCALES}
    for lang in LOCALES:
        ui = content[lang]["ui"]
        page = indexes[lang]
        entries = content[lang]["articles"]
        links = "".join(
            f'<li><a href="{local_link(page, article_path(lang, key))}">{escape(entry["title"])}</a>'
            f'<p>{escape(entry["description"])}</p></li>'
            for key, entry in entries.items()
        )
        body = f'<h1>{escape(ui["articles"])}</h1><ul class="guide-index">{links}</ul>'
        pages[page] = document(lang, page, ui["articles"], entries["log"]["description"], ui,
                               indexes, language_menu(page, ui, indexes, content, lang), body)
        alternates[page] = indexes
        for topic in TOPICS:
            group = {code: article_path(code, topic) for code in LOCALES}
            pages[group[lang]] = article(lang, topic, content, group)
            alternates[group[lang]] = group
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            ui["vehicle"], ui["date"], ui["odometer"], ui["entry"],
            f'{ui["fuel"]} ({ui["litres"]})', ui["amount"], ui["currency"], ui["notes"],
        ])
        currency, fuel_price, service_price = {
            "en": ("USD", "62.40", "80.00"), "ru": ("RUB", "2600.00", "4800.00"),
            "de": ("EUR", "62.40", "80.00"), "fr": ("EUR", "62.40", "80.00"),
            "es": ("MXN", "930.00", "1800.00"), "hi": ("INR", "3900.00", "4800.00"),
            "ar": ("SAR", "90.00", "200.00"), "zh-Hans": ("CNY", "312.00", "480.00"),
        }[lang]
        writer.writerow(["Demo", "2026-04-03", 23480, ui["fillup"], 39, fuel_price, currency, ui["example"]])
        writer.writerow(["Demo", "2026-04-12", 23940, ui["service"], "", service_price, currency, ui["example"]])
        downloads[csv_path(lang)] = buf.getvalue()
    return pages, alternates, downloads


def sitemap(pages):
    root = ET.Element("urlset", {"xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"})
    for page in pages:
        ET.SubElement(ET.SubElement(root, "url"), "loc").text = BASE + ("" if page == "index.html" else page)
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="unicode", xml_declaration=True) + "\n"
