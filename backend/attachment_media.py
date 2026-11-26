"""Normalize accepted attachments before persisting application records."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_FILE = 20 * 1024 * 1024


def normalize_attachment(content):
    if len(content) > MAX_FILE or not content:
        raise ValueError("Файл должен быть от 1 байта до 20 МБ")
    media = "application/octet-stream"
    try:
        if content.startswith((b"\xff\xd8\xff", b"\x89PNG", b"RIFF")):
            Image.MAX_IMAGE_PIXELS = 25000000
            with Image.open(io.BytesIO(content)) as image:
                if image.width * image.height > 25000000:
                    raise ValueError("Изображение превышает 25 мегапикселей")
                image.load()
                image = ImageOps.exif_transpose(image)
                image.thumbnail((2400, 2400))
                output = io.BytesIO()
                image.convert("RGB").save(output, format="JPEG", quality=90)
                content, media = output.getvalue(), "image/jpeg"
        elif content.startswith(b"%PDF-"):
            media = "application/pdf"
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValueError("Изображение повреждено или слишком велико") from None
    return content, media
