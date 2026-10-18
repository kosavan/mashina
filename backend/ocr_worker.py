"""One-shot native decoder/OCR process; no app imports or network operations."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import warnings


def transform_image(image, rotation=0, crop=None):
    if rotation:
        image = image.rotate(-rotation, expand=True)
    if crop:
        x, y, width, height = crop
        image = image.crop((round(x * image.width), round(y * image.height),
                            round((x + width) * image.width), round((y + height) * image.height)))
    if image.width < 1 or image.height < 1:
        raise ValueError("Проверьте границы обрезки")
    return image


def run_page(folder):
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
        (folder / "page.png").unlink(missing_ok=True)
        result = subprocess.run(
            [renderer, "-f", str(request["page"]), "-l", str(request["page"]),
             "-singlefile", "-scale-to", "3000", "-png", str(source), str(output)],
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
            image = transform_image(image, request.get("rotation", 0), request.get("crop"))
            image.thumbnail((2100, 2100), Image.Resampling.LANCZOS)
            # Small punctuation can disappear at screenshot resolution. Upscale at most
            # 2x, within the same bounded canvas used for PDF rendering.
            scale = min(2, 2100 / max(image.size))
            if scale > 1:
                image = image.resize(
                    (round(image.width * scale), round(image.height * scale)),
                    Image.Resampling.LANCZOS,
                )
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                image = Image.new("RGB", rgba.size, "white")
                image.paste(rgba, mask=rgba.getchannel("A"))
            # OCR works on luminance; normalize document contrast without changing digits.
            ImageOps.autocontrast(image.convert("L")).save(folder / "input.png", dpi=(300, 300))
    except Exception:
        raise ValueError("Нужен неповреждённый JPEG, PNG, WebP или PDF до 25 мегапикселей") from None
    result = subprocess.run(
        [engine, str(folder / "input.png"), str(folder / "ocr"), "-l", "eng+rus",
         "--psm", "6" if request["mode"] in {"receipt", "odometer"} else "3",
         "-c", "thresholding_method=2", "-c", "preserve_interword_spaces=1"],
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


def run(folder):
    request = json.loads((folder / "request.json").read_text())
    pages = request.get("pages", [request["page"]])
    with (folder / "source.bin").open("rb") as stream:
        is_pdf = stream.read(5) == b"%PDF-"
    if not is_pdf and pages != [1]:
        raise ValueError("Для изображения выберите только страницу 1")
    texts = []
    for page in pages:
        (folder / "request.json").write_text(json.dumps({**request, "page": page}))
        value = run_page(folder)["text"]
        texts.append((f"--- Page {page} ---\n" if len(pages) > 1 else "") + value)
    result = "\n\n".join(texts)
    if len(result.encode("utf8")) > 64 * 1024:
        raise ValueError("Результат распознавания слишком большой")
    return {"text": result}


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
