"""On-demand, opt-in suggestions from the fixed NHTSA vPIC endpoint."""

from datetime import date
import json
import re
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import Depends, HTTPException, Request as APIRequest
from pydantic import BaseModel, ConfigDict, Field

from backend.access import vehicle_access
from backend.storage import Conflict, Denied, uid


class VINRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def lookup(vin, year=None):
    vin = (vin or "").strip().upper()
    if not re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", vin):
        raise ValueError("Для расшифровки нужен VIN из 17 символов")
    args = {"format": "json"}
    if year:
        args["modelyear"] = year
    address = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?{urlencode(args)}"
    request = Request(address, headers={"Accept": "application/json"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=6) as response:
            blob = response.read(128 * 1024 + 1)
        if len(blob) > 128 * 1024:
            raise ValueError()
        result = json.loads(blob)["Results"][0]
        if not isinstance(result, dict):
            raise ValueError()
    except (URLError, TimeoutError, ValueError, KeyError, IndexError, TypeError):
        # Provider errors can contain the request URL, including the VIN.
        raise HTTPException(502, "Сервис расшифровки VIN сейчас недоступен") from None

    fields = {}
    for source, key in (
        ("Make", "brand"), ("Model", "model"), ("Trim", "trim"),
        ("EngineModel", "engine"), ("TransmissionStyle", "transmission"),
        ("DriveType", "drive"), ("FuelTypePrimary", "fuel"),
    ):
        value = result.get(source)
        if isinstance(value, str) and value.strip() and len(value.strip()) <= 100:
            fields[key] = value.strip()
    model_year = result.get("ModelYear")
    if isinstance(model_year, str) and re.fullmatch(r"\d{4}", model_year):
        if 1886 <= int(model_year) <= date.today().year + 1:
            fields["year"] = int(model_year)
    return {"fields": fields, "partial": result.get("ErrorCode") != "0"}


def install_vin_lookup(app, session, throttle):
    @app.post("/api/v1/vehicles/{vehicle_id}/decode-vin")
    def decode_vin(vehicle_id: str, body: VINRequest, request: APIRequest, s=Depends(session)):
        if s["demo"]:
            raise Denied("Расшифровка VIN доступна в личном гараже")
        with s["store"].transaction() as connection:
            car, _ = vehicle_access(connection, uid(vehicle_id), s["user_id"], write=True)
            if car["version"] != body.expected_version:
                raise Conflict("Запись изменилась. Обновите данные.")
            data = json.loads(car["data"])
        throttle(request, "vin-decode", 10)
        return lookup(data.get("vin"), data.get("year"))
