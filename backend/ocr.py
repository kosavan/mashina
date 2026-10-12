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


def recognize(content: bytes, mode: str, page: int):
    if mode not in {"receipt", "service", "odometer", "screenshot"}:
        raise ValueError("Выберите тип распознавания")
    if not 1 <= page <= 20:
        raise ValueError("Выберите страницу от 1 до 20")
    if not 0 < len(content) <= MAX_SOURCE:
        raise ValueError("Файл должен быть от 1 байта до 20 МБ")
    if not LOCK.acquire(blocking=False):
        raise ValueError("Распознавание занято. Попробуйте через минуту.")
    try:
        with tempfile.TemporaryDirectory(prefix="mashina-ocr-") as work:
            folder = Path(work)
            (folder / "source.bin").write_bytes(content)
            (folder / "request.json").write_text(json.dumps({"mode": mode, "page": page}))
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
            return {"text": raw, "fields": suggestions(raw, mode), "engine": "tesseract-local"}
    except OSError:
        raise ValueError("Не удалось запустить локальное распознавание") from None
    finally:
        LOCK.release()
