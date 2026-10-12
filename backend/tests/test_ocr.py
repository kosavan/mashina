import io
import os
from pathlib import Path
import shutil
import subprocess

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont
import pytest

from backend.ocr import LOCK, recognize, suggestions
from backend.tests.test_api import mutate


@pytest.mark.parametrize("text, mode, expected", [
    ("ИТОГО: 1234,56\nЛитры: 20,5\nЦена за литр: 60,22\n12.10.2026", "receipt",
     {"amount": "1234.56", "liters": "20.5", "price": "60.22", "occurred_at": "2026-10-12"}),
    ("TOTAL 10.00\nTOTAL 20.00", "screenshot", {}),
    ("Balance 100000\nTrip 123\nRange 456\nFull tank", "receipt", {}),
    ("ODO 123456 km", "odometer", {"odometer": "123456"}),
    ("ODO 123456 mi", "odometer", {}),
    ("123456\nTrip 1234", "odometer", {}),
    ("Пробег: 123 456 км\nИтого 1000", "odometer", {"odometer": "123456"}),
    ("TOTAL 1000.01\nLiters 20\n2026-10-12", "service", {"amount": "1000.01", "occurred_at": "2026-10-12"}),
    ("31.02.2026\nTOTAL 0", "receipt", {}),
    ("12.10.2026\n13.10.2026", "service", {}),
    ("ИТОГО 10\nОДОМЕТР 9999999", "receipt", {"amount": "10"}),
])
def test_only_unambiguous_printed_facts(text, mode, expected):
    assert suggestions(text, mode) == expected


def test_limits_and_busy_before_native_processing():
    for content, mode, page in [(b"", "receipt", 1), (b"x", "other", 1), (b"x", "receipt", 21)]:
        with pytest.raises(ValueError):
            recognize(content, mode, page)
    with LOCK:
        with pytest.raises(ValueError, match="занято"):
            recognize(b"x", "receipt", 1)


def test_recognition_is_private_transient_and_revocation_checked(client, monkeypatch):
    car = mutate(client, "vehicle", {"name": "Local OCR"}).json()["record"]
    calls = []

    def engine(content, mode, page):
        calls.append((content, mode, page))
        return {"text": "TOTAL 123.45", "fields": {"amount": "123.45"}, "engine": "tesseract-local"}

    monkeypatch.setattr("backend.app.recognize", engine)
    def send(c, **data):
        return c.post("/api/v1/ocr", data={"vehicle_id": car["id"], "mode": "receipt", **data},
                      files={"file": ("private.png", b"image", "image/png")})
    assert send(TestClient(client.app)).status_code == 401
    token = client.headers.pop("X-CSRF-Token")
    assert send(client).status_code == 403
    client.headers["X-CSRF-Token"] = token
    assert send(client, page="21").status_code == 422
    assert not calls
    assert send(client).json()["fields"]["amount"] == "123.45"
    state = client.get("/api/v1/state").json()
    assert state["events"] == [] and state["attachments"] == []
    account = client.post("/api/v1/users", json={"username": "other", "password": "test-other-password"})
    assert account.status_code == 200
    with TestClient(client.app) as other:
        login = other.post("/api/v1/login", json={"username": "other", "password": "test-other-password"})
        other.headers["X-CSRF-Token"] = login.json()["csrf"]
        assert send(other).status_code == 403
    assert len(calls) == 1


def require_engine():
    if not shutil.which("tesseract") or not shutil.which("pdftoppm"):
        if os.environ.get("CI"):
            pytest.fail("Real local OCR engine and renderer are mandatory in CI")
        pytest.skip("Local Windows OCR engine not installed; actual-engine coverage required in CI")


@pytest.mark.parametrize("pdf", [False, True])
@pytest.mark.parametrize("russian", [False, True])
def test_real_local_engine_image_and_pdf(pdf, russian):
    require_engine()
    font_path = Path("backend/assets/fonts/Manrope-Regular.ttf")
    font = ImageFont.truetype(str(font_path), 40)
    image = Image.new("RGB", (1400, 500), "white")
    printed = "ИТОГО: 1234.56\nОдометр: 123456 км\n12.10.2026" if russian else "TOTAL 1234.56\nODO 123456 km\n2026-10-12"
    ImageDraw.Draw(image).multiline_text((60, 40), printed, fill="black", font=font, spacing=24)
    output = io.BytesIO()
    image.save(output, format="PDF" if pdf else "PNG", resolution=150)
    result = recognize(output.getvalue(), "receipt", 1)
    expected = {"amount": "1234.56", "odometer": "123456", "occurred_at": "2026-10-12"}
    if result["fields"] != expected:
        # Synthetic fixtures only: diagnose resolution without relaxing numeric assertions.
        for scale in (0.75, 1.25, 1.5, 2):
            resized = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
            candidate = io.BytesIO()
            resized.save(candidate, format="PNG")
            print("synthetic scale", scale, recognize(candidate.getvalue(), "receipt", 1))
    assert result["engine"] == "tesseract-local"
    assert result["fields"].get("amount") == "1234.56", result
    assert result["fields"].get("odometer") == "123456", result
    assert result["fields"].get("occurred_at") == "2026-10-12", result
    assert ("ИТОГО" if russian else "TOTAL") in result["text"]


def test_native_failure_cleans_up_and_releases_lock():
    require_engine()
    with pytest.raises(ValueError):
        recognize(b"not an image", "receipt", 1)
    assert not LOCK.locked()


def test_timeout_kills_worker_and_cleans_temp(monkeypatch):
    folders = []
    killed = []
    class Process:
        pid = 987654
        def __init__(self, args, **kwargs):
            folders.append(Path(args[-1]))
            assert "-I" in args and kwargs["env"]["OMP_THREAD_LIMIT"] == "1"
            assert "HTTP_PROXY" not in kwargs["env"]
        def wait(self, timeout=None):
            if timeout:
                raise subprocess.TimeoutExpired("local-ocr", timeout)
        def kill(self):
            killed.append(self.pid)
    monkeypatch.setattr("backend.ocr.subprocess.Popen", Process)
    monkeypatch.setattr("backend.ocr.os.killpg", lambda pid, signal: killed.append(pid), raising=False)
    with pytest.raises(ValueError, match="Истекло время"):
        recognize(b"private image", "screenshot", 1)
    assert killed == [987654] and not LOCK.locked()
    assert all(not folder.exists() for folder in folders)


def test_revoked_driver_cannot_receive_native_result(client, monkeypatch):
    car = mutate(client, "vehicle", {"name": "Shared OCR"}).json()["record"]
    user = client.post("/api/v1/users", json={"username": "driver", "password": "test-driver-password"}).json()
    assert client.put(f"/api/v1/vehicles/{car['id']}/access/{user['id']}", json={"role": "driver"}).status_code == 200
    def revoke(content, mode, page):
        client.delete(f"/api/v1/vehicles/{car['id']}/access/{user['id']}")
        return {"text": "PRIVATE OCR CONTENT", "fields": {}, "engine": "tesseract-local"}
    monkeypatch.setattr("backend.app.recognize", revoke)
    with TestClient(client.app) as driver:
        login = driver.post("/api/v1/login", json={"username": "driver", "password": "test-driver-password"})
        driver.headers["X-CSRF-Token"] = login.json()["csrf"]
        response = driver.post("/api/v1/ocr", data={"vehicle_id": car["id"], "mode": "screenshot"}, files={"file": ("private.png", b"image", "image/png")})
        assert response.status_code == 403
        assert "PRIVATE OCR CONTENT" not in response.text
