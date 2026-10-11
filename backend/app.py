"""Versioned, same-origin API and private file handlers for the MASHINA monolith."""

from contextlib import asynccontextmanager
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import tempfile
import time
import uuid
from urllib.parse import quote

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, ConfigDict

from backend.storage import Store, Conflict, Denied, dumps, uid
from backend.domain import analytics, iso, text
from backend.backup import make_backup, restore_backup, MAX_ARCHIVE
from backend.demo import seed
from backend.ownership import ownership_report, csv_rows, import_row
from backend.access import vehicle_access, upload_access, attachment_access
from backend.accounts import install_accounts, require_admin
from backend.reports import ReportOptions, report_snapshot, render_report, RENDER_LOCK

HASHER = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
PREFIX = "/api/v1"
MAX_FILE = 20 * 1024 * 1024


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=256)
    bootstrap_token: str = Field(default="", max_length=256)


class Mutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: uuid.UUID
    id: uuid.UUID
    entity: str
    action: str
    expected_version: int | None = None
    data: dict = Field(default_factory=dict)


def create_app(data_path=None, bootstrap_token=None):
    data_path = Path(data_path or os.getenv("MASHINA_DATA", "data"))
    store = Store(data_path)
    demos = {}
    attempts = {}
    dummy_hash = HASHER.hash(secrets.token_urlsafe(32))

    @asynccontextmanager
    async def lifespan(app):
        yield
        for item in demos.values():
            item["store"].close()
            item["temp"].cleanup()
        store.close()

    app = FastAPI(
        title="MASHINA", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None
    )
    app.state.store = store
    cookie_name = (
        "__Host-mashina" if os.getenv("MASHINA_SECURE_COOKIES") == "1" else "mashina_session"
    )
    origin = os.getenv("MASHINA_ORIGIN", "").rstrip("/")

    @app.middleware("http")
    async def secure_headers(request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            allowed = origin or str(request.base_url).rstrip("/")
            if request.headers.get("origin") and request.headers["origin"].rstrip("/") != allowed:
                return JSONResponse({"detail": "Недопустимый источник запроса"}, status_code=403)
            size = request.headers.get("content-length")
            if size and (not size.isdigit() or int(size) > MAX_ARCHIVE + 1024 * 1024):
                return JSONResponse({"detail": "Запрос слишком большой"}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
        )
        if request.url.path.startswith(PREFIX):
            response.headers["Cache-Control"] = "no-store"
        if request.url.path == "/sw.js":
            response.headers["Cache-Control"] = "no-cache"
        return response

    @app.exception_handler(ValueError)
    async def invalid(request, exc):
        code = 409 if isinstance(exc, Conflict) else 403 if isinstance(exc, Denied) else 422
        return JSONResponse({"detail": str(exc)}, status_code=code)

    def throttle(request, bucket="login", limit=10):
        key = (request.client.host if request.client else "local", bucket)
        now = time.time()
        recent = [t for t in attempts.get(key, []) if t > now - 300]
        if len(recent) >= limit:
            raise HTTPException(429, "Слишком много попыток. Подождите 5 минут.")
        attempts[key] = recent + [now]
        if len(attempts) > 10000:
            attempts.clear()

    def session(request: Request):
        token = request.cookies.get(cookie_name, "")
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        demo = demos.get(token_hash)
        if demo and demo["expires"] > time.time():
            result = demo
        else:
            rows = store.query(
                "SELECT sessions.*,username,is_admin FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>? AND users.disabled=0",
                (token_hash, int(time.time())),
            )
            if not rows:
                raise HTTPException(401, "Войдите в MASHINA")
            result = {**rows[0], "store": store, "demo": False}
        if request.method not in {"GET", "HEAD"} and not secrets.compare_digest(
            request.headers.get("X-CSRF-Token", ""), result["csrf"]
        ):
            raise HTTPException(403, "Сеанс требует обновления. Перезагрузите страницу.")
        return result

    def login_response(user_id, username, active_store=store, demo=False, temp=None):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode()).hexdigest()
        expires = int(time.time()) + (7200 if demo else 7 * 86400)
        if demo:
            demos[digest] = {
                "user_id": user_id,
                "username": username,
                "csrf": csrf,
                "expires": expires,
                "store": active_store,
                "demo": True,
                "temp": temp,
            }
        else:
            with store.transaction() as c:
                c.exec_driver_sql("DELETE FROM sessions WHERE expires<?", (int(time.time()),))
                c.exec_driver_sql(
                    "INSERT INTO sessions VALUES(?,?,?,?)", (digest, user_id, csrf, expires)
                )
        account = active_store.query("SELECT is_admin FROM users WHERE id=?", (user_id,))
        response = JSONResponse(
            {
                "id": user_id,
                "username": username,
                "csrf": csrf,
                "demo": demo,
                "is_admin": bool(account and account[0]["is_admin"]) and not demo,
            }
        )
        response.set_cookie(
            cookie_name,
            token,
            httponly=True,
            secure=os.getenv("MASHINA_SECURE_COOKIES") == "1",
            samesite="strict",
            max_age=expires - int(time.time()),
            path="/",
        )
        return response

    @app.get(PREFIX + "/health")
    def health():
        revision = store.query("SELECT version_num FROM alembic_version")[0]["version_num"]
        return {"status": "ok", "schema": revision}

    @app.get(PREFIX + "/setup")
    def setup_status():
        return {"required": not bool(store.query("SELECT id FROM users LIMIT 1"))}

    @app.post(PREFIX + "/setup")
    def setup(body: Credentials, request: Request):
        throttle(request, "setup")
        token_path = store.path / ".bootstrap-token"
        expected = (
            bootstrap_token
            or os.getenv("MASHINA_BOOTSTRAP_TOKEN")
            or (token_path.read_text().strip() if token_path.exists() else "")
        )
        with store.transaction() as c:
            if c.exec_driver_sql("SELECT id FROM users LIMIT 1").first():
                raise Conflict("Администратор уже создан; открытая регистрация отключена")
            if not expected or not secrets.compare_digest(body.bootstrap_token, expected):
                raise Denied("Нужен одноразовый код установки с вашего сервера")
            owner = str(uuid.uuid4())
            c.exec_driver_sql(
                "INSERT INTO users(id,username,password_hash,is_admin) VALUES(?,?,?,1)",
                (owner, body.username.strip(), HASHER.hash(body.password)),
            )
        if token_path.exists():
            token_path.unlink()
        return login_response(owner, body.username)

    @app.post(PREFIX + "/login")
    def login(body: Credentials, request: Request):
        throttle(request)
        users = store.query("SELECT * FROM users WHERE username=?", (body.username.strip(),))
        try:
            HASHER.verify(users[0]["password_hash"] if users else dummy_hash, body.password)
        except (VerificationError, InvalidHashError):
            raise HTTPException(401, "Неверное имя или пароль") from None
        if not users or users[0]["disabled"]:
            raise HTTPException(401, "Неверное имя или пароль")
        return login_response(users[0]["id"], users[0]["username"])

    @app.post(PREFIX + "/demo")
    def demo_login(request: Request):
        throttle(request, "demo", 12)
        prior_demo = hashlib.sha256(request.cookies.get(cookie_name, "").encode()).hexdigest()
        for key in list(demos):
            if demos[key]["expires"] <= time.time() or key == prior_demo:
                demos[key]["store"].close()
                demos[key]["temp"].cleanup()
                del demos[key]
        if len(demos) >= 32:
            raise HTTPException(429, "Все демо-сеансы заняты; попробуйте позже")
        temp = tempfile.TemporaryDirectory(prefix="mashina-demo-")
        demo_store = Store(temp.name)
        owner = seed(demo_store)
        return login_response(owner, "Демо-гараж", demo_store, True, temp)

    @app.get(PREFIX + "/session")
    def get_session(s=Depends(session)):
        return {
            "id": s["user_id"],
            "username": s["username"],
            "csrf": s["csrf"],
            "demo": s["demo"],
            "is_admin": bool(s.get("is_admin")) and not s["demo"],
        }

    @app.post(PREFIX + "/logout")
    def logout(request: Request, s=Depends(session)):
        digest = hashlib.sha256(request.cookies.get(cookie_name, "").encode()).hexdigest()
        if s["demo"]:
            s["store"].close()
            s["temp"].cleanup()
            demos.pop(digest, None)
        else:
            with store.transaction() as c:
                c.exec_driver_sql("DELETE FROM sessions WHERE token_hash=?", (digest,))
        response = JSONResponse({"ok": True})
        response.delete_cookie(cookie_name, path="/")
        return response

    @app.get(PREFIX + "/state")
    def state(s=Depends(session)):
        return s["store"].state(s["user_id"])

    @app.post(PREFIX + "/mutate")
    def mutate(body: Mutation, s=Depends(session)):
        return s["store"].mutate(s["user_id"], body.model_dump(mode="json"))

    @app.get(PREFIX + "/analytics")
    def get_analytics(
        vehicle_id="", start="", end="", category="", kind="", currency="RUB", s=Depends(session)
    ):
        if vehicle_id:
            with s["store"].transaction() as c:
                vehicle_access(c, uid(vehicle_id), s["user_id"])
        state = s["store"].state(s["user_id"])
        vehicles = [v for v in state["vehicles"] if not vehicle_id or v["id"] == vehicle_id]
        ids = {v["id"] for v in vehicles}
        if start:
            iso(start)
        if end:
            iso(end)
        if start and end and start > end:
            raise ValueError("Начало периода позже конца")
        return analytics(
            vehicles,
            [e for e in state["events"] if e["vehicle_id"] in ids],
            start,
            end,
            category,
            kind,
            currency,
        )

    @app.get(PREFIX + "/ownership")
    def get_ownership(vehicle_id: str, month: str, s=Depends(session)):
        active_store = s["store"]
        with active_store.transaction() as c:
            vehicle_access(c, uid(vehicle_id), s["user_id"], write=True)
        return ownership_report(active_store.state(s["user_id"]), vehicle_id, month)

    @app.post(PREFIX + "/import/csv/preview")
    async def preview_csv(
        file: UploadFile = File(...), vehicle_id: str = Form(...), s=Depends(session)
    ):
        active_store = s["store"]
        with active_store.transaction() as c:
            vehicle_access(c, uid(vehicle_id), s["user_id"], write=True)
        rows = csv_rows(await file.read(2 * 1024 * 1024 + 1), s["user_id"], vehicle_id)
        for row in rows:
            if row.get("error"):
                continue
            existing = active_store.query(
                "SELECT data FROM events WHERE id=? AND vehicle_id=?", (row["id"], vehicle_id)
            )
            if existing:
                if (
                    json.loads(existing[0]["data"]).get("import_fingerprint")
                    == row["data"]["import_fingerprint"]
                ):
                    row["duplicate"] = True
                else:
                    row["error"] = "Внешний ID уже существует с другими данными"
        return {"rows": rows}

    class ImportCommit(BaseModel):
        vehicle_id: uuid.UUID
        rows: list[dict] = Field(min_length=1, max_length=1000)
        confirm_odometer: bool = False

    @app.post(PREFIX + "/import/csv/commit")
    def commit_csv(body: ImportCommit, s=Depends(session)):
        vehicle_id, active_store = str(body.vehicle_id), s["store"]
        rows = [import_row(source, s["user_id"], vehicle_id) for source in body.rows]
        if (
            any(row["data"].get("odometer") is not None for row in rows)
            and not body.confirm_odometer
        ):
            raise ValueError("Подтвердите исторические показания пробега перед импортом")
        records = []
        with active_store.transaction() as c:
            vehicle_access(c, vehicle_id, s["user_id"], write=True)
            for row in rows:
                row["data"]["odometer_confirmed"] = row["data"].get("odometer") is not None
                payload = {
                    "operation_id": row["operation_id"],
                    "id": row["id"],
                    "entity": "event",
                    "action": "create",
                    "data": row["data"],
                }
                records.append(active_store.mutate(s["user_id"], payload, connection=c)["record"])
        return {"records": records}

    @app.post(PREFIX + "/attachments")
    async def upload(
        file: UploadFile = File(...),
        vehicle_id: str = Form(...),
        event_id: str = Form(""),
        title: str = Form(""),
        document_type: str = Form("Прочее"),
        issued: str = Form(""),
        expires: str = Form(""),
        notes: str = Form(""),
        s=Depends(session),
    ):
        active_store = s["store"]
        vehicle_id = uid(vehicle_id)
        event_id = uid(event_id) if event_id else ""
        with active_store.transaction() as c:
            upload_access(c, vehicle_id, event_id, s["user_id"])
        content = await file.read(MAX_FILE + 1)
        if len(content) > MAX_FILE or not content:
            raise ValueError("Файл должен быть от 1 байта до 20 МБ")
        media = "application/octet-stream"
        try:
            if content.startswith((b"\xff\xd8\xff", b"\x89PNG", b"RIFF")):
                Image.MAX_IMAGE_PIXELS = 25000000
                with Image.open(io.BytesIO(content)) as image:
                    if image.width * image.height > 25000000:
                        raise ValueError("Изображение превышает 25 мегапикселей")
                    image.load()
                    image.thumbnail((2400, 2400))
                    output = io.BytesIO()
                    image.convert("RGB").save(output, format="JPEG", quality=90)
                    content, media = output.getvalue(), "image/jpeg"
            elif content.startswith(b"%PDF-"):
                media = "application/pdf"
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise ValueError("Изображение повреждено или слишком велико") from None
        attachment_id = str(uuid.uuid4())
        filename = attachment_id + ".bin"
        metadata = {
            "title": text(title or file.filename, maximum=200, required=True),
            "original_name": text(file.filename, maximum=200),
            "document_type": text(document_type),
            "issued": iso(issued, True)[:10],
            "expires": iso(expires, True)[:10],
            "notes": text(notes, maximum=4000),
            "media_type": media,
            "size": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        with active_store.lock:
            target = active_store.uploads / filename
            target.write_bytes(content)
            try:
                with active_store.transaction() as c:
                    car = upload_access(c, vehicle_id, event_id, s["user_id"])
                    c.exec_driver_sql(
                        "INSERT INTO attachments(id,owner_id,vehicle_id,event_id,filename,data,created_by,visibility) VALUES(?,?,?,?,?,?,?,'owner')",
                        (
                            attachment_id,
                            car["owner_id"],
                            vehicle_id,
                            event_id or None,
                            filename,
                            dumps(metadata),
                            s["user_id"],
                        ),
                    )
            except Exception:
                target.unlink(missing_ok=True)
                raise
        return {
            **metadata,
            "id": attachment_id,
            "vehicle_id": vehicle_id,
            "event_id": event_id,
            "created_by": s["user_id"],
            "visibility": "owner",
            "can_edit": True,
        }

    @app.get(PREFIX + "/attachments/{attachment_id}")
    def get_file(attachment_id: str, download: bool = False, s=Depends(session)):
        active_store = s["store"]
        with active_store.transaction() as c:
            row, _ = attachment_access(c, uid(attachment_id), s["user_id"])
        meta = json.loads(row["data"])
        inline = not download and meta["media_type"] in {"image/jpeg", "application/pdf"}
        return FileResponse(
            active_store.uploads / row["filename"],
            media_type=meta["media_type"],
            headers={
                "Content-Disposition": f"{'inline' if inline else 'attachment'}; filename*=UTF-8''{quote(meta['original_name'] or meta['title'])}"
            },
        )

    @app.patch(PREFIX + "/attachments/{attachment_id}")
    async def update_file(attachment_id: str, request: Request, s=Depends(session)):
        body = await request.json()
        active_store = s["store"]
        with active_store.transaction() as c:
            row, role = attachment_access(c, uid(attachment_id), s["user_id"], write=True)
            if "visibility" in body:
                if role != "owner":
                    raise Denied("Доступом к документу управляет владелец")
                if body["visibility"] not in {"owner", "shared"}:
                    raise ValueError("Неизвестный доступ к документу")
                car, _ = vehicle_access(c, row["vehicle_id"], s["user_id"])
                if (
                    body["visibility"] == "owner"
                    and json.loads(car["data"]).get("photo_id") == attachment_id
                ):
                    raise ValueError(
                        "Обложка доступна всем участникам; сначала уберите её из профиля"
                    )
                c.exec_driver_sql(
                    "UPDATE attachments SET visibility=? WHERE id=?",
                    (body["visibility"], attachment_id),
                )
            meta = json.loads(row["data"])
            for key in ("title", "document_type", "notes", "issued", "expires"):
                if key in body:
                    meta[key] = (
                        iso(body[key], True)[:10]
                        if key in {"issued", "expires"}
                        else text(
                            body[key],
                            maximum=4000 if key == "notes" else 200,
                            required=key == "title",
                        )
                    )
            c.exec_driver_sql(
                "UPDATE attachments SET data=? WHERE id=?", (dumps(meta), attachment_id)
            )
        return {"ok": True}

    @app.delete(PREFIX + "/attachments/{attachment_id}")
    def delete_file(attachment_id: str, s=Depends(session)):
        active_store = s["store"]
        with active_store.transaction() as c:
            attachment, _ = attachment_access(c, uid(attachment_id), s["user_id"], write=True)
            for row in c.exec_driver_sql(
                "SELECT id,data FROM vehicles WHERE id=?", (attachment["vehicle_id"],)
            ).mappings():
                data = json.loads(row["data"])
                if data.get("photo_id") == attachment_id:
                    data["photo_id"] = ""
                    c.exec_driver_sql(
                        "UPDATE vehicles SET data=?,version=version+1 WHERE id=?",
                        (dumps(data), row["id"]),
                    )
            c.exec_driver_sql("DELETE FROM attachments WHERE id=?", (attachment_id,))
        return {"ok": True}

    def real_only(s):
        if s["demo"]:
            raise Denied("Архивы и экспорт доступны в личном гараже. Демо изолировано.")

    @app.get(PREFIX + "/export.json")
    def export_json(s=Depends(session)):
        real_only(s)
        return Response(
            dumps(s["store"].state(s["user_id"])),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=mashina.json"},
        )

    @app.get(PREFIX + "/export.csv")
    def export_csv(s=Depends(session)):
        real_only(s)
        state = s["store"].state(s["user_id"])
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)
        writer.writerow(["entity", "id", "vehicle_id", "event_id", "data_json"])
        for entity in (
            "vehicles",
            "events",
            "categories",
            "reminders",
            "attachments",
            "tire_sets",
            "budgets",
            "recurring_costs",
        ):
            for record in state[entity]:
                writer.writerow(
                    [
                        entity,
                        record["id"],
                        record.get("vehicle_id", ""),
                        record.get("event_id", ""),
                        dumps(record),
                    ]
                )
        return Response(
            "\ufeff" + buffer.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=mashina.csv"},
        )

    def archive_only(s):
        real_only(s)
        with s["store"].transaction() as c:
            require_admin(s, c)

    @app.get(PREFIX + "/backup")
    def backup(s=Depends(session)):
        archive_only(s)
        return Response(
            make_backup(store),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=mashina-backup.zip"},
        )

    @app.post(PREFIX + "/restore")
    async def restore(file: UploadFile = File(...), s=Depends(session)):
        archive_only(s)
        blob = await file.read(MAX_ARCHIVE + 1)
        with store.lock:
            archive_only(s)
            restore_backup(store, blob)
        return {"ok": True, "login_required": True}

    install_accounts(app, session, HASHER, login_response, throttle)

    @app.post(PREFIX + "/vehicles/{vehicle_id}/sale-report")
    def sale_report(vehicle_id: str, body: ReportOptions, request: Request, s=Depends(session)):
        throttle(request, "sale-report", 12)
        if not RENDER_LOCK.acquire(blocking=False):
            raise HTTPException(
                429, "Другой отчёт ещё готовится. Повторите через несколько секунд."
            )
        try:
            snapshot = report_snapshot(s["store"], s["user_id"], uid(vehicle_id), body, s["demo"])
            blob = render_report(snapshot)
        finally:
            RENDER_LOCK.release()
        return Response(
            blob,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=mashina-sale-report.pdf"},
        )

    frontend = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if frontend.exists():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return app


app = create_app()
