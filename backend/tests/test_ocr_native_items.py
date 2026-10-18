import io

from reportlab.pdfgen.canvas import Canvas

from backend.ocr import recognize
from backend.tests.test_ocr import require_engine


def test_native_service_table_exposes_reviewable_exact_items():
    require_engine()
    output = io.BytesIO()
    document = Canvas(output, pagesize=(900, 500))
    document.setFont("Courier", 24)
    for i, line in enumerate(["Name       SKU       Qty   Price", "Oil        OIL-1     2     100.00", "Filter     FIL-2     1     50.00"]):
        document.drawString(35, 400 - i * 55, line)
    document.save()
    result = recognize(output.getvalue(), "service", 1)
    assert any(item["name"] == "Oil" and item["quantity"] == "2"
               and item["unit_price"] == "100.00" for item in result["items"]), result
