"""Translate only application-owned output labels; never stored user text."""
import json
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("output_locales.json").read_text(encoding="utf8"))


def output_locale(value):
    return value if value in {"ru", "en", "de"} else "en"


def user_locale(store, actor):
    rows = store.query("SELECT settings FROM users WHERE id=?", (actor,))
    return output_locale(json.loads(rows[0]["settings"]).get("locale", "ru")) if rows else "ru"


def user_units(store, actor):
    rows = store.query("SELECT settings FROM users WHERE id=?", (actor,))
    settings = json.loads(rows[0]["settings"]) if rows else {}
    return {
        "currency": settings.get("currency", "RUB"),
        "distance_unit": settings.get("distance_unit", "km"),
        "volume_unit": settings.get("volume_unit", "l"),
        "consumption_unit": settings.get("consumption_unit", "l_100km"),
    }


def translate(label, locale):
    return CATALOG.get(label, {}).get(output_locale(locale), label)


def number(value, locale="ru", decimals=0):
    raw = f"{value:,.{decimals}f}"
    if locale == "en":
        return raw
    if locale == "de":
        return raw.translate(str.maketrans({",": ".", ".": ","}))
    return raw.replace(",", " ").replace(".", ",")
