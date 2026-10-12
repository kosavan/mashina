"""Real isolated image/PDF rendering, with generated non-private sources."""

import io

from PIL import Image
from pypdf import PdfReader, PdfWriter
import pytest
from reportlab.pdfgen import canvas

from backend.recognition_media import inspect_media, render_media


def photo():
    output = io.BytesIO()
    image = Image.new("RGBA", (1900, 1000), (0, 0, 0, 0))
    image.save(output, "PNG")
    return output.getvalue()


def scanned_pdf(pages=2):
    from reportlab.lib.utils import ImageReader

    output = io.BytesIO()
    document = canvas.Canvas(output)
    for i in range(pages):
        document.drawImage(ImageReader(io.BytesIO(photo())), 30, 300, width=500, height=260)
        document.showPage()
    document.save()
    return output.getvalue()


def test_image_normalization_strips_metadata_flattens_alpha_and_caps_pixels():
    assert inspect_media(photo(), "image/jpeg") == {"page_count": 1, "media_type": "image"}
    images = render_media(photo(), "image/jpeg", [1])
    assert len(images) == 1
    with Image.open(io.BytesIO(images[0])) as image:
        assert image.format == "JPEG"
        assert image.mode == "RGB"
        assert max(image.size) <= 1600
        assert image.width * image.height <= 2560000
        assert not image.getexif()
        assert image.getpixel((0, 0)) == (255, 255, 255)


def test_scanned_pdf_renders_only_selected_pages_and_has_no_text_requirement():
    content = scanned_pdf()
    assert all(not page.extract_text().strip() for page in PdfReader(io.BytesIO(content)).pages)
    assert inspect_media(content, "application/pdf")["page_count"] == 2
    images = render_media(content, "application/pdf", [2])
    assert len(images) == 1
    assert images[0].startswith(b"\xff\xd8\xff")
    with Image.open(io.BytesIO(images[0])) as image:
        assert max(image.size) <= 1600


@pytest.mark.parametrize("pages", [[], [0], [3], [1, 1], [1, 2, 3, 4, 5, 6], [True], ["1"]])
def test_invalid_page_selection_never_renders(pages):
    with pytest.raises(ValueError):
        render_media(scanned_pdf(), "application/pdf", pages)


def test_encrypted_and_oversized_page_geometry_rejected_without_raster_allocation():
    for encrypted, width in [(True, 600), (False, 100000)]:
        writer = PdfWriter()
        writer.add_blank_page(width=width, height=600)
        if encrypted:
            writer.encrypt("not-a-user-secret")
        output = io.BytesIO()
        writer.write(output)
        with pytest.raises(ValueError):
            inspect_media(output.getvalue(), "application/pdf")


def test_malformed_unsupported_animated_and_oversized_sources_rejected():
    animated = io.BytesIO()
    Image.new("RGB", (10, 10)).save(
        animated, "PNG", save_all=True, append_images=[Image.new("RGB", (10, 10), "white")]
    )
    for content, media in [
        (b"%PDF-broken", "application/pdf"),
        (b"bad image", "image/jpeg"),
        (b"x", "application/octet-stream"),
        (b"", "image/jpeg"),
        (b"x" * (20 * 1024 * 1024 + 1), "image/jpeg"),
        (animated.getvalue(), "image/jpeg"),
    ]:
        with pytest.raises(ValueError):
            inspect_media(content, media)


def test_renderer_deadline_is_reported_without_document_content(tmp_path, monkeypatch):
    import subprocess
    import backend.recognition_media as module

    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired(args[0], 30, output=b"PRIVATE SOURCE")

    monkeypatch.setattr(module.subprocess, "run", timeout)
    with pytest.raises(ValueError, match="время") as error:
        inspect_media(photo(), "image/jpeg")
    assert "PRIVATE" not in str(error.value)


def test_exif_rotation_is_respected_and_not_transmitted():
    image = Image.new("RGB", (100, 200))
    exif = image.getexif()
    exif[274] = 6
    exif[315] = "PRIVATE AUTHOR"
    output = io.BytesIO()
    image.save(output, "JPEG", exif=exif)
    [result] = render_media(output.getvalue(), "image/jpeg", [1])
    with Image.open(io.BytesIO(result)) as normalized:
        assert normalized.size == (200, 100)
        assert not normalized.getexif()
    assert b"PRIVATE AUTHOR" not in result
