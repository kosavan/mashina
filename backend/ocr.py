"""Local, transient OCR suggestions. Recognition never writes application data."""

from datetime import date
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import threading

MAX_SOURCE = 20 * 1024 * 1024
MAX_TEXT = 64 * 1024
LOCK = threading.Lock()
WORKER = Path(__file__).with_name("ocr_worker.py")


def suggestions(text, mode):
    """Only explicit, unique labelled facts. Never infer a fuel purchase or full tank."""
    fields = {}
    lines = text.splitlines()
    patterns = {
        "amount": r"(?:итого(?:\s+к\s+оплате)?|всего\s+к\s+оплате|grand\s+total|total\s+due|total)\s*[:=]?\s*(\d[\d ]*(?:[.,]\d{1,2})?)(?:\s*(?:₽|руб\.?|RUB))?\s*$",
        "liters": r"(?:литр[ыаов]*|об[ъь]ем|litres?|liters?|volume)\s*[:=]?\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:л|L)?\s*$",
        "price": r"(?:цена\s*(?:за\s*)?(?:литра|литр|1\s*л)|price\s*(?:per\s*)?(?:litre|liter)|unit\s+price)\s*[:=]?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|RUB)?\s*$",
        "odometer": r"(?:одометр|пробег|odometer|odo)\s*[:=]?\s*(\d[\d ]{0,8})\s*(?:км|km)?\s*$",
    }
    keys = {"odometer"} if mode == "odometer" else set(patterns)
    if mode != "receipt":
        keys -= {"liters", "price"}
    for key in keys:
        found = set()
        for line in lines:
            match = re.match(patterns[key], line.strip(), re.I)
            if match:
                raw = match[1].replace(" ", "").replace(",", ".")
                try:
                    value = Decimal(raw)
                    if key == "odometer" and value <= 3000000:
                        found.add(str(int(value)))
                    elif key != "odometer" and 0 < value <= 10000000000:
                        found.add(raw)
                except InvalidOperation:
                    pass
        if len(found) == 1:
            fields[key] = found.pop()
    # A label followed by miles does not match the kilometre odometer pattern.
    if mode != "odometer":
        dates = set()
        for match in re.finditer(r"(?<!\d)(\d{2})[./](\d{2})[./](\d{4})(?!\d)", text):
            try:
                dates.add(date(int(match[3]), int(match[2]), int(match[1])).isoformat())
            except ValueError:
                pass
        for match in re.finditer(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)", text):
            try:
                dates.add(date(int(match[1]), int(match[2]), int(match[3])).isoformat())
            except ValueError:
                pass
        if len(dates) == 1:
            fields["occurred_at"] = dates.pop()
    return fields


def parse_options(page, pages=None, rotation=0, crop=None):
    selected = [page] if pages is None else pages
    if (not isinstance(selected, list) or not 1 <= len(selected) <= 3
            or any(type(p) is not int or not 1 <= p <= 20 for p in selected)
            or len(set(selected)) != len(selected)):
        raise ValueError("Выберите до трёх разных страниц от 1 до 20")
    if type(rotation) is not int or rotation not in {0, 90, 180, 270}:
        raise ValueError("Выберите поворот 0, 90, 180 или 270 градусов")
    if crop is not None:
        if (not isinstance(crop, list) or len(crop) != 4
                or any(type(v) not in {int, float} or not 0 <= v <= 1 for v in crop)):
            raise ValueError("Проверьте границы обрезки")
        x, y, width, height = crop
        if width < .01 or height < .01 or x + width > 1.000001 or y + height > 1.000001:
            raise ValueError("Проверьте границы обрезки")
    return {"pages": selected, "rotation": rotation, "crop": crop}


def line_items(text):
    """Only labelled tables; unstructured/ambiguous rows remain reviewable text."""
    aliases = {
        "name": {"name", "description", "item", "наименование", "название", "работа"},
        "part_number": {"part", "part number", "sku", "артикул"},
        "quantity": {"qty", "quantity", "кол-во", "количество"},
        "unit_price": {"price", "unit price", "цена"},
    }
    labels = sorted({name for names in aliases.values() for name in names}, key=len, reverse=True)
    label_pattern = "(?:" + "|".join(re.escape(name) for name in labels) + ")"
    columns, result = {}, []
    for line in text.splitlines():
        cells = [s.strip() for s in re.split(r"\s*\|\s*|\t+| {2,}", line.strip())]
        # Tesseract can collapse gaps between short header labels to one space.
        # Accept only a complete sequence of known labels; unknown columns still
        # invalidate the header, and data rows retain their stricter separators.
        if re.fullmatch(label_pattern + r"(?:\s+" + label_pattern + r")+", line.strip(), re.I):
            cells = re.findall(label_pattern, line.strip(), re.I)
        header = {key: i for i, cell in enumerate(cells)
                  for key, names in aliases.items() if cell.casefold() in names}
        if {"name", "quantity", "unit_price"} <= header.keys():
            # Tax/discount/total columns need manual review, never silently discard them.
            columns = header if len(header) == len(cells) else {}
            continue
        if not columns or len(cells) != len(columns):
            continue
        item = {key: cells[i] for key, i in columns.items()}
        if not item["name"] or len(item["name"]) > 200 or item["name"].casefold() in {"total", "subtotal", "итого", "всего"}:
            continue
        if any(not re.fullmatch(r"\d{1,8}(?:[.,]\d{1,2})?", item[key])
               for key in ("quantity", "unit_price")):
            continue
        quantity, price = (Decimal(item[key].replace(",", "."))
                           for key in ("quantity", "unit_price"))
        if not 0 < quantity <= 100000 or price < 0 or quantity * price > 10000000000:
            continue
        if len(item.get("part_number", "")) > 100:
            continue
        result.append({**item, "part_number": item.get("part_number", ""),
                       "quantity": str(quantity), "unit_price": str(price), "discount": "0"})
        if len(result) == 100:
            break
    return result


def recognize(content: bytes, mode: str, page: int, *, pages=None, rotation=0, crop=None):
    if mode not in {"receipt", "service", "odometer", "screenshot"}:
        raise ValueError("Выберите тип распознавания")
    if not 1 <= page <= 20:
        raise ValueError("Выберите страницу от 1 до 20")
    options = parse_options(page, pages, rotation, crop)
    if not 0 < len(content) <= MAX_SOURCE:
        raise ValueError("Файл должен быть от 1 байта до 20 МБ")
    if not LOCK.acquire(blocking=False):
        raise ValueError("Распознавание занято. Попробуйте через минуту.")
    try:
        with tempfile.TemporaryDirectory(prefix="mashina-ocr-") as work:
            folder = Path(work)
            (folder / "source.bin").write_bytes(content)
            (folder / "request.json").write_text(json.dumps({"mode": mode, "page": page, **options}))
            environment = {
                key: os.environ[key]
                for key in ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TESSDATA_PREFIX")
                if key in os.environ
            }
            environment.update(PYTHONIOENCODING="utf-8", OMP_THREAD_LIMIT="1")
            process = subprocess.Popen(
                [sys.executable, "-I", str(WORKER.resolve()), work],
                cwd=work, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=os.name != "nt",
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            try:
                process.wait(timeout=45)
            except subprocess.TimeoutExpired:
                if os.name != "nt":
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait()
                raise ValueError("Истекло время локального распознавания") from None
            output = folder / "result.json"
            if not output.exists() or output.stat().st_size > MAX_TEXT * 3:
                raise ValueError("Не удалось распознать файл. Попробуйте другой снимок.")
            result = json.loads(output.read_text(encoding="utf-8"))
            if result.get("error"):
                raise ValueError(result["error"])
            raw = result.get("text")
            if not isinstance(raw, str) or len(raw.encode("utf-8")) > MAX_TEXT:
                raise ValueError("Результат распознавания слишком большой")
            return {"text": raw, "fields": suggestions(raw, mode), "engine": "tesseract-local",
                    "items": line_items(raw) if mode == "service" else [],
                    "pages": options["pages"]}
    except OSError:
        raise ValueError("Не удалось запустить локальное распознавание") from None
    finally:
        LOCK.release()
