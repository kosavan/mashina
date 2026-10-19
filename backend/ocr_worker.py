"""One-shot native decoder/OCR process; no app imports or network operations."""

import json
import csv
import io
import time
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



def seven_segment_candidate(image):
    """Conservative fixed-segment baseline for tightly cropped LCD digits.

    Experimental candidates only: cannot distinguish an odometer from trip/range.
    Reject broken/unknown glyphs instead of repairing them or inferring units.
    """
    from PIL import ImageOps, ImageStat

    gray = ImageOps.autocontrast(image.convert("L"))
    if ImageStat.Stat(gray).mean[0] < 110:
        gray = ImageOps.invert(gray)
    mask = gray.point(lambda value: 255 if value < 128 else 0)
    bounds = mask.getbbox()
    if not bounds:
        return None
    mask = mask.crop(bounds)
    width, height = mask.size
    if height < 20 or width / height > 7:
        return None
    active = [mask.crop((x, 0, x + 1, height)).histogram()[255] >= max(2, height * .04)
              for x in range(width)]
    groups, start = [], None
    for x, on in enumerate([*active, False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            groups.append((start, x))
            start = None
    merged = []
    for left, right in groups:
        if merged and left - merged[-1][1] <= height * .08:
            merged[-1] = (merged[-1][0], right)
        else:
            merged.append((left, right))
    groups = merged
    if not 4 <= len(groups) <= 7:
        return None
    patterns = {"1111110": "0", "0110000": "1", "1101101": "2", "1111001": "3",
                "0110011": "4", "1011011": "5", "1011111": "6", "1110000": "7",
                "1111111": "8", "1111011": "9"}
    # a,b,c,d,e,f,g at the centre of each bar, leaving corners out.
    probes = [(.25, .02, .75, .14), (.83, .18, 1, .40), (.83, .60, 1, .82),
              (.25, .86, .75, .98), (0, .60, .17, .82), (0, .18, .17, .40),
              (.25, .44, .75, .56)]
    digits = ""
    for left, right in groups:
        w = right - left
        if w / height < .22:
            digits += "1"
            continue
        if not .3 <= w / height <= .85:
            return None
        bars = ""
        for x1, y1, x2, y2 in probes:
            area = mask.crop((left + round(x1*w), round(y1*height),
                              left + round(x2*w), round(y2*height)))
            bars += "1" if ImageStat.Stat(area).mean[0] > 128 else "0"
        if bars not in patterns:
            return None
        digits += patterns[bars]
    return digits if int(digits) <= 3000000 else None

def run_page(folder, deadline):
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
    request = json.loads((folder / "request.json").read_text())
    source = folder / "source.bin"
    with source.open("rb") as stream:
        is_pdf = stream.read(5) == b"%PDF-"
    if is_pdf:
        extractor = shutil.which("pdftotext")
        if extractor and not request.get("crop") and not request.get("rotation"):
            native = folder / "native.txt"
            native.unlink(missing_ok=True)
            extracted = subprocess.run(
                [extractor, "-f", str(request["page"]), "-l", str(request["page"]),
                 "-layout", "-enc", "UTF-8", str(source), str(native)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            if extracted.returncode == 0 and native.exists() and native.stat().st_size <= 64 * 1024:
                text = native.read_text(encoding="utf8").strip()
                if sum(character.isalnum() for character in text) >= 8 and "\ufffd" not in text:
                    return {"text": text, "confidence": 100, "alternatives": [text]}
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
    if not engine:
        raise ValueError("Установите локальный Tesseract с языками rus и eng на сервере")
    from PIL import Image, ImageOps, ImageFilter, ImageStat

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
            image.thumbnail((2800, 2800), Image.Resampling.LANCZOS)
            # Small punctuation can disappear at screenshot resolution. Upscale at most
            # 2x, within the same bounded canvas used for PDF rendering.
            scale = min(2, 2800 / max(image.size))
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
            image = ImageOps.autocontrast(image.convert("L"))
            # Light text on a dark instrument panel needs inverted luminance.
            if ImageStat.Stat(image).mean[0] < 110:
                image = ImageOps.invert(image)
            baseline = image.copy()
            baseline.thumbnail((2100, 2100), Image.Resampling.LANCZOS)
            baseline.save(folder / "input.png", dpi=(300, 300))
            image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=100, threshold=3)).save(
                folder / "sharp.png", dpi=(300, 300))
    except Exception:
        raise ValueError("Нужен неповреждённый JPEG, PNG, WebP или PDF до 25 мегапикселей") from None
    passes = [("input", "6" if request["mode"] in {"receipt", "odometer"} else "3"),
              ("sharp", "11" if request["mode"] != "service" else "6")]
    results = []
    for index, (source_name, segmentation) in enumerate(passes):
        remaining = deadline - time.monotonic()
        if remaining < 2:
            break
        output = folder / f"ocr-{index}"
        result = subprocess.run(
            [engine, str(folder / (source_name + ".png")), str(output), "-l", "eng+rus",
             "--psm", segmentation, "-c", f"thresholding_method={2 if index == 0 else 0}",
             "-c", "preserve_interword_spaces=1", "txt", "tsv"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=min(20, remaining),
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        text_path, tsv_path = output.with_suffix(".txt"), output.with_suffix(".tsv")
        if result.returncode or not text_path.exists():
            continue
        if text_path.stat().st_size > 64 * 1024 or tsv_path.stat().st_size > 4 * 1024 * 1024:
            raise ValueError("Результат распознавания слишком большой")
        text = text_path.read_text(encoding="utf-8").strip()
        if not text:
            continue
        rows = csv.DictReader(io.StringIO(tsv_path.read_text(encoding="utf-8")), delimiter="\t")
        confidence = [float(row["conf"]) for row in rows if row.get("text", "").strip()
                      and float(row["conf"]) >= 0]
        score = sum(confidence) / max(1, len(confidence))
        results.append({"text": text, "confidence": round(score, 1)})
    if request["mode"] == "odometer" and request.get("crop"):
        candidate = seven_segment_candidate(image)
        if candidate:
            results.append({"text": candidate, "confidence": 0})
    if not results:
        raise ValueError("Текст не найден. Проверьте снимок и языки rus и eng на сервере.")
    best = max(results, key=lambda result: result["confidence"])
    return {**best, "alternatives": [r["text"] for r in results]}


def run(folder):
    request = json.loads((folder / "request.json").read_text())
    pages = request.get("pages", [request["page"]])
    with (folder / "source.bin").open("rb") as stream:
        is_pdf = stream.read(5) == b"%PDF-"
    if not is_pdf and pages != [1]:
        raise ValueError("Для изображения выберите только страницу 1")
    texts, alternatives, scores = [], [], []
    deadline = time.monotonic() + 65
    for page in pages:
        (folder / "request.json").write_text(json.dumps({**request, "page": page}))
        result = run_page(folder, deadline)
        value = result["text"]
        alternatives.extend(result["alternatives"])
        scores.append(result["confidence"])
        texts.append((f"--- Page {page} ---\n" if len(pages) > 1 else "") + value)
    result = "\n\n".join(texts)
    if len(result.encode("utf8")) > 64 * 1024:
        raise ValueError("Результат распознавания слишком большой")
    return {"text": result, "alternatives": alternatives,
            "confidence": round(sum(scores) / len(scores), 1)}


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
