"""Account-owned CSV mapping presets. No imported rows or files are retained."""

import json
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field

from backend.bank_csv import Mapping as BankMapping
from backend.domain import text
from backend.history_csv import HistoryMapping
from backend.ownership import CSV_COLUMNS
from backend.storage import dumps

PREFIX = "/api/v1/import/profiles"
SETTINGS_KEY = "csv_import_profiles"
ProfileKind = Literal["history", "bank"]


class HistoryProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["history"]
    name: str = Field(min_length=1, max_length=80)
    mapping: HistoryMapping


class BankProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["bank"]
    name: str = Field(min_length=1, max_length=80)
    mapping: BankMapping
    encoding: Literal["utf-8", "cp1251"]
    delimiter: Literal["comma", "semicolon", "tab"]


ProfileInput = Annotated[HistoryProfile | BankProfile, Field(discriminator="kind")]


def _settings(c, owner):
    return json.loads(
        c.exec_driver_sql("SELECT settings FROM users WHERE id=?", (owner,)).scalar_one()
    )


def _save(c, owner, settings, profiles):
    settings[SETTINGS_KEY] = profiles
    c.exec_driver_sql("UPDATE users SET settings=? WHERE id=?", (dumps(settings), owner))


def _validate_mapping(profile):
    if isinstance(profile, HistoryProfile):
        mapping = profile.mapping
        columns = mapping.columns
        if (
            set(columns) - CSV_COLUMNS
            or "occurred_at" not in columns
            or not ("kind" in columns or mapping.default_kind)
            or len(set(columns.values())) != len(columns)
        ):
            raise ValueError("Проверьте сопоставление колонок CSV")
    else:
        mapping = profile.mapping
        columns = [mapping.date, mapping.amount, mapping.description]
        columns += [header for header in (mapping.transaction_id, mapping.currency) if header]
        if len(set(columns)) != len(columns):
            raise ValueError("Проверьте сопоставление колонок CSV")


def install_import_profiles(app, session):
    @app.get(PREFIX)
    def list_profiles(kind: ProfileKind, s=Depends(session)):
        with s["store"].transaction() as c:
            settings = _settings(c, s["user_id"])
        return [item for item in settings.get(SETTINGS_KEY, []) if item["kind"] == kind]

    @app.post(PREFIX)
    def save_profile(body: ProfileInput, s=Depends(session)):
        _validate_mapping(body)
        name = text(body.name, maximum=80, required=True)
        owner = s["user_id"]
        with s["store"].transaction() as c:
            settings = _settings(c, owner)
            profiles = settings.get(SETTINGS_KEY, [])
            prior = next(
                (item for item in profiles
                 if item["kind"] == body.kind and item["name"].casefold() == name.casefold()),
                None,
            )
            if prior is None and len(profiles) >= 24:
                raise ValueError("Можно сохранить до 24 шаблонов импорта")
            result = {
                **body.model_dump(mode="json"),
                "name": name,
                "id": prior["id"] if prior else str(uuid4()),
            }
            _save(c, owner, settings, [item for item in profiles if item is not prior] + [result])
        return result

    @app.delete(PREFIX + "/{profile_id}")
    def remove_profile(profile_id: UUID, s=Depends(session)):
        owner = s["user_id"]
        with s["store"].transaction() as c:
            settings = _settings(c, owner)
            profiles = settings.get(SETTINGS_KEY, [])
            remaining = [item for item in profiles if item["id"] != str(profile_id)]
            if len(remaining) != len(profiles):
                _save(c, owner, settings, remaining)
        return {"ok": True}
