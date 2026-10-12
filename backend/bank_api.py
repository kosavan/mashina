"""Typed same-origin API for optional, deliberately reviewed local bank exports."""

import uuid
from typing import Literal

from fastapi import Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend.access import vehicle_access
from backend import bank_import
from backend.bank_csv import Mapping, MAX_CSV, inspect_csv
from backend.storage import uid

PREFIX = "/api/v1/bank"


class SourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehicle_id: uuid.UUID
    label: str = Field(min_length=1, max_length=80)


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    row_id: int = Field(ge=1, le=1000, strict=True)
    action: Literal["create", "link", "ignore"]
    event_id: uuid.UUID | None = None
    expected_version: int | None = Field(default=None, ge=1, strict=True)
    category: str = Field(default="", max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    ack_separate: bool = False


class CommitInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: uuid.UUID
    batch_id: uuid.UUID
    decisions: list[Decision] = Field(min_length=1, max_length=1000)


def install_bank(app, session, throttle):
    @app.get(PREFIX + "/sources")
    def list_sources(vehicle_id: uuid.UUID, s=Depends(session)):
        return bank_import.sources(s["store"], s["user_id"], str(vehicle_id))

    @app.post(PREFIX + "/sources")
    def create_source(body: SourceInput, s=Depends(session)):
        return bank_import.add_source(s["store"], s["user_id"], str(body.vehicle_id), body.label)

    @app.post(PREFIX + "/inspect")
    async def inspect(
        file: UploadFile = File(...),
        vehicle_id: str = Form(...),
        encoding: str = Form(...),
        delimiter: str = Form(...),
        s=Depends(session),
    ):
        with s["store"].transaction() as c:
            vehicle_access(c, uid(vehicle_id), s["user_id"], write=True)
        return inspect_csv(await file.read(MAX_CSV + 1), encoding, delimiter)

    @app.post(PREFIX + "/preview")
    async def preview(
        file: UploadFile = File(...),
        vehicle_id: str = Form(...),
        source_id: str = Form(...),
        mapping: str = Form(...),
        encoding: str = Form(...),
        delimiter: str = Form(...),
        s=Depends(session),
    ):
        vehicle_id, source_id = uid(vehicle_id), uid(source_id)
        # Do not return Pydantic's input value in errors (a bank mapping can contain private labels).
        if len(mapping) > 4000:
            raise ValueError("Слишком большое сопоставление столбцов")
        try:
            fields = Mapping.model_validate_json(mapping)
        except ValidationError:
            raise ValueError("Проверьте столбцы, формат даты, валюту и знак расходов") from None
        return bank_import.preview(
            s["store"],
            s["user_id"],
            vehicle_id,
            source_id,
            await file.read(MAX_CSV + 1),
            encoding,
            delimiter,
            fields,
        )

    @app.post(PREFIX + "/commit")
    def confirm(body: CommitInput, s=Depends(session)):
        return bank_import.commit(s["store"], s["user_id"], body.model_dump(mode="json"))

    @app.get(PREFIX + "/export")
    def export(vehicle_id: uuid.UUID, s=Depends(session)):
        return JSONResponse(
            bank_import.export_private(s["store"], s["user_id"], str(vehicle_id)),
            headers={"Content-Disposition": 'attachment; filename="mashina-bank-review.json"'},
        )
