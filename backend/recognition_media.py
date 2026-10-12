"""Bounded one-shot native renderer. No native PDF parsing in request threads."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

MAX_SOURCE = 20 * 1024 * 1024
MAX_IMAGE = 2 * 1024 * 1024
WORKER = Path(__file__).with_name("recognition_worker.py").resolve()


def validate_pages(pages):
    if (
        not isinstance(pages, list)
        or not 1 <= len(pages) <= 5
        or any(type(page) is not int or not 1 <= page <= 100 for page in pages)
        or len(set(pages)) != len(pages)
    ):
        raise ValueError("Выберите от одной до пяти разных страниц")


def _run(content, media, pages=None):
    if not isinstance(content, bytes) or not 1 <= len(content) <= MAX_SOURCE:
        raise ValueError("Документ должен быть от 1 байта до 20 МБ")
    if media not in {"image/jpeg", "application/pdf"}:
        raise ValueError("Распознавание поддерживает изображения и PDF")
    if pages is not None:
        validate_pages(pages)
    # Private ephemeral files are never served or persisted in the browser.
    with tempfile.TemporaryDirectory(prefix="mashina-render-") as work:
        folder = Path(work)
        (folder / "source.bin").write_bytes(content)
        (folder / "request.json").write_text(
            json.dumps({"media": media, "pages": pages}), encoding="utf-8"
        )
        environment = {
            key: os.environ[key]
            for key in ("SYSTEMROOT", "WINDIR", "TEMP", "TMP")
            if key in os.environ
        }
        environment["PYTHONIOENCODING"] = "utf-8"
        try:
            result = subprocess.run(
                [sys.executable, "-I", str(WORKER), str(folder)],
                cwd=folder,
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=30,
                check=False,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        except subprocess.TimeoutExpired:
            raise ValueError("Истекло время обработки документа") from None
        except OSError:
            raise ValueError("Не удалось запустить обработку документа") from None
        if result.returncode or len(result.stdout) > 4096:
            raise ValueError("Документ повреждён, защищён или превышает пределы обработки")
        try:
            metadata = json.loads(result.stdout)
            if (
                set(metadata) != {"page_count", "media_type"}
                or type(metadata["page_count"]) is not int
                or not 1 <= metadata["page_count"] <= 100
                or metadata["media_type"] not in {"image", "pdf"}
            ):
                raise ValueError()
            images = []
            for index in range(len(pages or [])):
                target = folder / f"page-{index}.jpg"
                if not 1 <= target.stat().st_size <= MAX_IMAGE:
                    raise ValueError()
                image = target.read_bytes()
                if not image.startswith(b"\xff\xd8\xff"):
                    raise ValueError()
                images.append(image)
            return metadata, images
        except (ValueError, OSError, TypeError):
            raise ValueError("Не удалось проверить результат обработки документа") from None


def inspect_media(content: bytes, media: str) -> dict:
    return _run(content, media)[0]


def render_media(content: bytes, media: str, pages: list[int]) -> list[bytes]:
    return _run(content, media, pages)[1]
