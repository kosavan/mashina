"""Rebuildable private card previews; original attachment bytes/IDs stay intact."""
import hashlib
from pathlib import Path
import os
import tempfile

from PIL import Image, ImageOps


def card_preview(store, filename: str, checksum: str) -> tuple[Path, str]:
    key = hashlib.sha256((filename + checksum + "card-v1").encode()).hexdigest()
    directory = store.path / "previews"
    directory.mkdir(exist_ok=True)
    target = directory / (key + ".webp")
    if not target.exists():
        with Image.open(store.uploads / filename) as original:
            if original.width * original.height > 25000000:
                raise ValueError("Изображение превышает 25 мегапикселей")
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((960, 640), Image.Resampling.LANCZOS)
            handle, temporary = tempfile.mkstemp(dir=directory, suffix=".tmp")
            try:
                with os.fdopen(handle, "wb") as stream:
                    image.save(stream, format="WEBP", quality=82, method=4)
                os.replace(temporary, target)
            finally:
                Path(temporary).unlink(missing_ok=True)
    return target, '"' + key + '"'
