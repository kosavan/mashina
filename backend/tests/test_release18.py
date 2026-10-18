import hashlib
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.ocr import line_items, parse_options, recognize
from backend.ocr_worker import transform_image
from backend.tests.test_api import mutate
from backend.tests.test_ocr import require_engine


def test_health_identifies_release_without_changing_schema(client):
    result = client.get("/api/v1/health").json()
    assert result == {"status": "ok", "schema": "007", "version": "1.8.0"}


def upload(client, image):
    car = mutate(client, "vehicle", {"name": "Original preserved"}).json()["record"]
    stream = io.BytesIO()
    image.save(stream, "PNG")
    response = client.post("/api/v1/attachments", data={"vehicle_id": car["id"], "title": "Cover"},
                           files={"file": ("cover.png", stream.getvalue(), "image/png")})
    assert response.status_code == 200
    return car, response.json()


def test_existing_cover_preview_is_small_private_and_preserves_original(client):
    _, attachment = upload(client, Image.effect_noise((1920, 1280), 75).convert("RGB"))
    url = "/api/v1/attachments/" + attachment["id"]
    original = client.get(url).content
    preview = client.get(url + "?variant=card")
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/webp"
    assert preview.headers["cache-control"] == "no-store"
    assert len(preview.content) < len(original) * .6
    with Image.open(io.BytesIO(preview.content)) as image:
        assert image.width <= 960 and image.height <= 640
    etag = preview.headers["etag"]
    assert client.get(url + "?variant=card", headers={"If-None-Match": etag}).status_code == 304
    assert client.get(url + "?variant=card&download=true").content == original
    assert hashlib.sha256(client.get(url).content).hexdigest() == attachment["sha256"]
    assert client.get("/api/v1/state").json()["attachments"][0]["id"] == attachment["id"]
    with TestClient(client.app) as anonymous:
        assert anonymous.get(url + "?variant=card", headers={"If-None-Match": etag}).status_code == 401
    client.post("/api/v1/users", json={"username": "preview-other", "password": "preview-test-password"})
    with TestClient(client.app) as other:
        other.post("/api/v1/login", json={"username": "preview-other", "password": "preview-test-password"})
        assert other.get(url + "?variant=card", headers={"If-None-Match": etag}).status_code == 403


def test_preview_rebuilds_after_backup_restore_without_original_changes(client, tmp_path):
    from backend.backup import restore_backup
    from backend.previews import card_preview
    from backend.storage import Store
    _, attachment = upload(client, Image.new("RGB", (1500, 1000), "green"))
    url = "/api/v1/attachments/" + attachment["id"]
    preview = client.get(url + "?variant=card").content
    archive = client.get("/api/v1/backup").content
    restored = Store(tmp_path / "restored")
    try:
        restore_backup(restored, archive)
        assert not (restored.path / "previews").exists()
        row = restored.query("SELECT filename FROM attachments WHERE id=?", (attachment["id"],))[0]
        target, _ = card_preview(restored, row["filename"], attachment["sha256"])
        assert target.read_bytes() == preview
        assert hashlib.sha256((restored.uploads / row["filename"]).read_bytes()).hexdigest() == attachment["sha256"]
    finally:
        restored.close()


def test_upload_applies_phone_exif_orientation(client):
    car = mutate(client, "vehicle", {"name": "Phone orientation"}).json()["record"]
    image = Image.new("RGB", (100, 200), "blue")
    metadata = Image.Exif()
    metadata[274] = 6
    stream = io.BytesIO()
    image.save(stream, "JPEG", exif=metadata)
    response = client.post("/api/v1/attachments", data={"vehicle_id": car["id"]},
                           files={"file": ("phone.jpg", stream.getvalue(), "image/jpeg")})
    assert response.status_code == 200
    with Image.open(io.BytesIO(client.get("/api/v1/attachments/" + response.json()["id"]).content)) as saved:
        assert saved.size == (200, 100)


@pytest.mark.parametrize("options", [
    {"pages": []}, {"pages": [1, 1]}, {"pages": [1, 2, 3, 4]}, {"pages": [21]},
    {"rotation": 45}, {"crop": [.9, 0, .5, 1]}, {"crop": [0, 0, 0, 1]},
    {"crop": [0, 0, float("nan"), 1]},
])
def test_ocr_options_rejected_before_native_worker(options):
    with pytest.raises(ValueError):
        parse_options(1, **options)


def test_clockwise_rotation_then_normalized_crop():
    image = Image.new("RGB", (100, 200), "red")
    image.paste("blue", (0, 100, 100, 200))
    rotated = transform_image(image, 90, [0, 0, .5, 1])
    assert rotated.size == (100, 100)
    assert rotated.getpixel((50, 50)) == (0, 0, 255)


def test_service_tables_are_explicit_bounded_and_exact():
    text = "Name | Part number | Qty | Price\nOil filter | ABC-12 | 2 | 123,45\nTOTAL | | 1 | 246.90"
    assert line_items(text) == [{"name": "Oil filter", "part_number": "ABC-12",
        "quantity": "2", "unit_price": "123.45", "discount": "0"}]
    assert line_items("Oil filter 2 123.45") == []
    assert line_items("Name | Qty | Price | Discount\nOil | 1 | 50 | 10") == []
    assert line_items("Name | Qty | Price\nOil | 1 | unknown") == []
    assert line_items("Name       SKU       Qty Price\nOil        OIL-1     2     100.00") == [
        {"name": "Oil", "part_number": "OIL-1", "quantity": "2", "unit_price": "100.00", "discount": "0"}]
    assert line_items("Name SKU Qty Price Tax\nOil  OIL-1  2  100.00  20") == []


def test_native_multi_page_ocr_does_not_guess_between_different_totals():
    require_engine()
    from reportlab.pdfgen.canvas import Canvas
    stream = io.BytesIO()
    document = Canvas(stream, pagesize=(672, 240))
    for amount in ("123.45", "234.56"):
        document.setFont("Helvetica", 24)
        document.drawString(30, 150, "TOTAL " + amount)
        document.showPage()
    document.save()
    result = recognize(stream.getvalue(), "receipt", 1, pages=[1, 2])
    assert result["pages"] == [1, 2]
    assert "123.45" in result["text"] and "234.56" in result["text"]
    assert "amount" not in result["fields"]


def test_native_rotated_crop_reads_only_selected_region():
    require_engine()
    from PIL import ImageDraw, ImageFont
    image = Image.new("RGB", (1800, 1000), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("backend/assets/fonts/Manrope-Regular.ttf", 45)
    draw.text((50, 40), "TOTAL 999.99", font=font, fill="black")
    draw.text((400, 400), "TOTAL 456.78", font=font, fill="black")
    stream = io.BytesIO()
    image.rotate(90, expand=True).save(stream, "PNG")
    result = recognize(stream.getvalue(), "receipt", 1, rotation=90, crop=[.15, .25, .7, .5])
    assert result["fields"]["amount"] == "456.78", result
    assert "999.99" not in result["text"]
