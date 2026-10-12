"""Ephemeral renderer entry point; no application imports or network operations.

Native parsing is isolated for lifecycle/time/resource control, not claimed as a
complete security sandbox. Keep PDFium/Pillow patched and deploy container caps.
"""

import json
import math
import os
from pathlib import Path
import sys
import warnings


def limit_resources():
    if sys.platform == "linux":
        import resource

        for kind, maximum in (
            (resource.RLIMIT_AS, 384 * 1024 * 1024),
            (resource.RLIMIT_CPU, 20),
            (resource.RLIMIT_FSIZE, 2 * 1024 * 1024),
            (resource.RLIMIT_CORE, 0),
        ):
            resource.setrlimit(kind, (maximum, maximum))


def write_image(image, folder, index):
    from PIL import Image, ImageOps

    image = ImageOps.exif_transpose(image)
    image.thumbnail((1600, 1600))
    if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
        rgba = image.convert("RGBA")
        fresh = Image.new("RGB", rgba.size, "white")
        fresh.paste(rgba, mask=rgba.getchannel("A"))
    else:
        fresh = Image.new("RGB", image.size)
        fresh.paste(image.convert("RGB"))
    fresh.save(folder / f"page-{index}.jpg", format="JPEG", quality=85, optimize=False)
    fresh.close()


def process(folder):
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = 25000000
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    request = json.loads((folder / "request.json").read_text(encoding="utf-8"))
    pages = request["pages"]
    if request["media"] == "image/jpeg":
        with Image.open(folder / "source.bin") as image:
            if (
                image.format not in {"JPEG", "PNG"}
                or getattr(image, "n_frames", 1) != 1
                or image.width * image.height > 25000000
            ):
                raise ValueError()
            image.load()  # Verify even on inspection; no corrupt source is declared ready.
            if pages is not None:
                if pages != [1]:
                    raise ValueError()
                write_image(image, folder, 0)
        return {"page_count": 1, "media_type": "image"}

    import pypdfium2 as pdfium

    with pdfium.PdfDocument(folder / "source.bin") as document:
        if pdfium.raw.FPDF_GetSecurityHandlerRevision(document) >= 0:
            raise ValueError()
        count = len(document)
        if not 1 <= count <= 100 or (pages is not None and any(p > count for p in pages)):
            raise ValueError()
        # Check geometry before allocating a bitmap, including unselected pages.
        for number in range(count):
            width, height = document.get_page_size(number)
            if (
                not all(math.isfinite(v) for v in (width, height))
                or min(width, height) < 1
                or max(width, height) > 14400
            ):
                raise ValueError()
        for index, number in enumerate(pages or []):
            page = document[number - 1]
            try:
                width, height = page.get_size()
                scale = min(150 / 72, 1600 / max(width, height))
                bitmap = page.render(scale=scale)
                try:
                    image = bitmap.to_pil().copy()
                finally:
                    bitmap.close()
                write_image(image, folder, index)
                image.close()
            finally:
                page.close()
        return {"page_count": count, "media_type": "pdf"}


if __name__ == "__main__":
    try:
        limit_resources()
        result = process(Path(sys.argv[1]))
        sys.stdout.write(json.dumps(result))
    except Exception:
        # No private source, native error detail or configuration in parent output.
        os._exit(1)
