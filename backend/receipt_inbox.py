"""Confirm a local receipt draft as one expense and one private attachment."""

import hashlib
from uuid import UUID, uuid4

from fastapi import Depends, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from backend.access import mutation_access, upload_access
from backend.attachment_media import MAX_FILE, normalize_attachment
from backend.domain import text
from backend.storage import dumps

PREFIX = "/api/v1/receipt-inbox/confirm"


def _save_receipt(store, owner, operation, content, original_name):
    body = operation["data"]
    vehicle_id = body["vehicle_id"]
    event_id = operation["id"]
    attachment_id = str(uuid4())
    filename = attachment_id + ".bin"
    target = store.uploads / filename
    metadata = {
        "title": original_name,
        "original_name": original_name,
        "document_type": "Чек",
        "issued": "",
        "expires": "",
        "notes": "",
        "media_type": "image/jpeg",
        "size": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }
    with store.lock:
        try:
            with store.transaction() as c:
                retry = c.exec_driver_sql(
                    "SELECT 1 FROM receipts WHERE owner_id=? AND operation_id=?",
                    (owner, operation["operation_id"]),
                ).scalar()
                result = store.mutate(owner, operation, connection=c)
                if not retry:
                    car = upload_access(c, vehicle_id, event_id, owner)
                    target.write_bytes(content)
                    c.exec_driver_sql(
                        """INSERT INTO attachments
                        (id,owner_id,vehicle_id,event_id,filename,data,created_by,visibility)
                        VALUES(?,?,?,?,?,?,?,'owner')""",
                        (attachment_id, car["owner_id"], vehicle_id, event_id, filename, dumps(metadata), owner),
                    )
        except Exception:
            target.unlink(missing_ok=True)
            raise
    return result


def install_receipt_inbox(app, session):
    @app.post(PREFIX)
    async def confirm_receipt(
        draft_id: UUID = Form(...),
        vehicle_id: UUID = Form(...),
        occurred_at: str = Form(..., max_length=10),
        amount: str = Form(..., max_length=24),
        currency: str = Form(..., pattern=r"^[A-Za-z]{3}$"),
        category: str = Form("", max_length=300),
        description: str = Form("", max_length=4000),
        file: UploadFile = File(...),
        s=Depends(session),
    ):
        owner = s["user_id"]
        store = s["store"]
        data = {
            "vehicle_id": str(vehicle_id), "kind": "expense", "occurred_at": occurred_at,
            "amount": amount, "currency": currency, "category": category, "description": description,
        }
        operation = {
            "operation_id": str(draft_id), "id": str(draft_id), "entity": "event",
            "action": "create", "data": data,
        }
        with store.transaction() as c:
            mutation_access(c, owner, "event", "create", operation["id"], data)
        content, media = await run_in_threadpool(normalize_attachment, await file.read(MAX_FILE + 1))
        if media != "image/jpeg":
            raise ValueError("Выберите фотографию чека в формате JPEG, PNG или WebP")
        original_name = text(file.filename, maximum=200) or "Чек"
        return await run_in_threadpool(_save_receipt, store, owner, operation, content, original_name)
