"""One-shot native decoder/OCR process; no app imports or network operations."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import warnings


def run(folder):
    if sys.platform == "linux":
        import resource

        for kind, maximum in (
            (resource.RLIMIT_AS, 512 * 1024 * 1024),
            (resource.RLIMIT_CPU, 30),
            (resource.RLIMIT_FSIZE, 16 * 1024 * 1024),
            (resource.RLIMIT_CORE, 0),
        ):
            resource.setrlimit(kind, (maximum, maximum))
    engine = shutil.which("tesseract")
    if not engine:
        raise ValueError("Установите локальный Tesseract с языками rus и eng на сервере")
    request = json.loads((folder / "request.json").read_text())
    source = folder / "source.bin"
    with source.open("rb") as stream:
        is_pdf = stream.read(5) == b"%PDF-"
    if is_pdf:
        renderer = shutil.which("pdftoppm")
        if not renderer:
            raise ValueError("Для PDF установите poppler-utils на сервере")
        output = folder / "page"
        result = subprocess.run(
            [renderer, "-f", str(request["page"]), "-l", str(request["page"]),
             "-singlefile", "-scale-to", "2400", "-png", str(source), str(output)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=12,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        source = folder / "page.png"
        if result.returncode or not source.exists():
            raise ValueError("PDF повреждён, защищён или выбранной страницы нет")
    from PIL import Image, ImageOps

    Image.MAX_IMAGE_PIXELS = 25000000
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    try:
        with Image.open(source) as original:
            if original.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError()
            if original.width * original.height > 25000000:
                raise ValueError()
            original.load()
            image = ImageOps.exif_transpose(original)
            image.thumbnail((2400, 2400))
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                image = Image.new("RGB", rgba.size, "white")
                image.paste(rgba, mask=rgba.getchannel("A"))
            image.convert("RGB").save(folder / "input.png")
    except Exception:
        raise ValueError("Нужен неповреждённый JPEG, PNG, WebP или PDF до 25 мегапикселей") from None
    result = subprocess.run(
        [engine, str(folder / "input.png"), str(folder / "ocr"), "-l", "rus+eng",
         "--psm", "6" if request["mode"] in {"receipt", "odometer"} else "3"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    output = folder / "ocr.txt"
    if result.returncode or not output.exists():
        raise ValueError("Локальный OCR не смог прочитать файл. Проверьте языки rus и eng.")
    if output.stat().st_size > 64 * 1024:
        raise ValueError("Результат распознавания слишком большой")
    text = output.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError("Текст не найден. Попробуйте более чёткий снимок.")
    return {"text": text}


if __name__ == "__main__":
    folder = Path(sys.argv[1])
    try:
        result = run(folder)
    except subprocess.TimeoutExpired:
        result = {"error": "Истекло время локального распознавания"}
    except ValueError as error:
        result = {"error": str(error)}
    except Exception:
        result = {"error": "Не удалось распознать файл. Попробуйте другой снимок."}
    (folder / "result.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
