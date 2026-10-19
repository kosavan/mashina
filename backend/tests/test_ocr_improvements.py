import io
import json
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont
import pytest
from reportlab.pdfgen.canvas import Canvas

from backend.ocr import line_items, recognize, review_candidates
from backend.ocr_worker import seven_segment_candidate
from backend.domain import normalize_event
from backend.tests.test_ocr import require_engine


def test_tax_discount_rows_reconcile_to_exact_financial_operation():
    text = "Name | SKU | Qty | Price | Discount % | VAT | Total\nOil | O-1 | 2 | 100.00 | 10 | 36.00 | 216.00"
    items = line_items(text)
    assert len(items) == 1 and items[0]["discount"] == "20.00"
    event = normalize_event({"kind": "maintenance", "occurred_at": "2026-01-01", "items": items})
    assert event["amount_minor"] == 21600
    assert event["items"][0]["amount_minor"] == 21600
    inclusive = line_items("Name | Qty | Price | Discount | VAT included | Total\nFilter | 2 | 100 | 20 | 30 | 180")
    assert inclusive[0]["unit_price"] == "100" and inclusive[0]["discount"] == "20"


@pytest.mark.parametrize("text", [
    "Name | Qty | Price | Tax\nOil | 2 | 100 | 20",  # tax basis unknown
    "Name | Qty | Price | Discount | Total\nOil | 2 | 100 | 10 | 199",  # arithmetic mismatch
    "Name | Qty | Price | Discount %\nOil | 2 | 100 | 110",  # invalid percent
    "Name | Qty | Price | Mystery\nOil | 2 | 100 | 20",  # unknown semantics
    "Name | Qty | Price | VAT included | Total\nOil | 2 | 100 | 40 | 240",
    "Name | Qty | Price | Discount | Discount %\nOil | 2 | 100 | 10 | 10",
])
def test_unsafe_table_rows_remain_source_text(text):
    assert line_items(text) == []


def test_multiple_labelled_and_unlabelled_odometer_candidates_are_explicit():
    assert review_candidates(["TOTAL 10.00\nTOTAL 20.00", "TOTAL 20.00"], "receipt") == {"amount": ["10.00", "20.00"]}
    assert review_candidates(["123456 km", "ODO 123458 km"], "odometer") == {"odometer": ["123456", "123458"]}
    assert review_candidates(["123456 mi\nTrip 1234\nRange 567"], "odometer") == {}


def test_pass_disagreement_does_not_preselect_a_value(monkeypatch):
    class Process:
        def __init__(self, args, **kwargs):
            Path(args[-1], "result.json").write_text(json.dumps({"text": "TOTAL 10.00", "alternatives": ["TOTAL 10.00", "TOTAL 20.00"]}))
        def wait(self, timeout=None):
            return 0
    monkeypatch.setattr("backend.ocr.subprocess.Popen", Process)
    result = recognize(b"test-image", "receipt", 1)
    assert result["fields"] == {}
    assert result["candidates"]["amount"] == ["10.00", "20.00"]


def segment_image(digits, inverted=False):
    image = Image.new("L", (len(digits) * 90 + 20, 120), 255)
    draw = ImageDraw.Draw(image)
    patterns = {"0": "1111110", "1": "0110000", "2": "1101101", "3": "1111001", "4": "0110011", "5": "1011011", "6": "1011111", "7": "1110000", "8": "1111111", "9": "1111011"}
    bars = [(12, 0, 48, 10), (50, 12, 60, 44), (50, 56, 60, 88), (12, 90, 48, 100),
            (0, 56, 10, 88), (0, 12, 10, 44), (12, 45, 48, 55)]
    for i, digit in enumerate(digits):
        for on, (x1, y1, x2, y2) in zip(patterns[digit], bars):
            if on == "1":
                draw.rectangle((20 + i*90 + x1, 10+y1, 20+i*90+x2, 10+y2), fill=0)
    if inverted:
        from PIL import ImageOps
        return ImageOps.invert(image)
    return image


@pytest.mark.parametrize("digits", ["123456", "078902", "230568"])
@pytest.mark.parametrize("inverted", [False, True])
def test_seven_segment_baseline_only_offers_candidates_for_clean_crops(digits, inverted):
    assert seven_segment_candidate(segment_image(digits, inverted)) == digits


def test_seven_segment_baseline_rejects_unknown_or_out_of_range():
    assert seven_segment_candidate(Image.new("L", (600, 100), 255)) is None
    assert seven_segment_candidate(segment_image("9999999")) is None


def test_native_pdf_preserves_text_and_table_without_rasterization():
    if not shutil.which("pdftotext"):
        pytest.skip("Poppler text extractor unavailable")
    buffer = io.BytesIO()
    document = Canvas(buffer, pagesize=(1000, 500))
    document.setFont("Courier", 18)
    for index, text in enumerate(["Name | Qty | Price | Discount % | VAT | Total", "Oil | 2 | 100.00 | 10 | 36.00 | 216.00", "TOTAL 216.00"]):
        document.drawString(30, 400-index*50, text)
    document.save()
    result = recognize(buffer.getvalue(), "service", 1)
    assert result["fields"]["amount"] == "216.00"
    assert result["items"][0]["discount"] == "20.00"


@pytest.mark.parametrize("dark", [False, True])
def test_native_low_contrast_and_dark_receipt(dark):
    require_engine()
    image = Image.new("RGB", (1600, 600), "#171717" if dark else "#dddddd")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("backend/assets/fonts/Manrope-Regular.ttf", 45)
    draw.multiline_text((80, 80), "TOTAL 1234.56\nODO 123456 km", font=font,
                        fill="#bbbbbb" if dark else "#777777", spacing=30)
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    result = recognize(buffer.getvalue(), "receipt", 1)
    assert "1234.56" in result["candidates"].get("amount", []), result
    assert "123456" in result["candidates"].get("odometer", []), result
    assert result["fields"].get("amount") in (None, "1234.56"), result
    assert result["fields"].get("odometer") in (None, "123456"), result


def test_percentage_tax_and_decimal_grouping_are_reconciled():
    items = line_items("Name | Qty | Price | VAT % | Total\nOil | 2 | 1,000.00 | 20 | 2,400.00")
    assert len(items) == 1
    assert normalize_event({"kind": "maintenance", "occurred_at": "2026-01-01", "items": items})["amount_minor"] == 240000
    assert line_items("Name | Qty | Price | VAT % | Total\nOil | 2 | 1.000,00 | 20 | 2.000,00")[0]["unit_price"] == "1000.00"
