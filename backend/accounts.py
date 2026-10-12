"""Local account lifecycle and per-car grants, with no public registration."""

from datetime import datetime
import uuid
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.exc import IntegrityError

from backend.access import vehicle_access
from backend.storage import Denied, Conflict, uid, dumps
from backend.domain import text
from backend.machine_access import revoke_user


def require_admin(s, c):
    user = c.exec_driver_sql(
        "SELECT is_admin,disabled FROM users WHERE id=?", (s["user_id"],)
    ).first()
    if s["demo"] or not user or not user[0] or user[1]:
        raise Denied("Действие доступно администратору установки")


class NewAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=256)


class AccountChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    disabled: bool | None = None
    password: str | None = Field(default=None, min_length=12, max_length=256)


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=12, max_length=256)


class Grant(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str


def install_accounts(app, session, hasher, login_response, throttle):
    prefix = "/api/v1"

    def audit(c, actor, entity, action, after):
        c.exec_driver_sql(
            "INSERT INTO audit(owner_id,entity_id,action,occurred_at,after_data) VALUES(?,?,?,?,?)",
            (actor, entity, action, datetime.now().isoformat(), dumps(after)),
        )

    @app.get(prefix + "/users")
    def users(s=Depends(session)):
        with s["store"].transaction() as c:
            require_admin(s, c)
            return [
                dict(r)
                for r in c.exec_driver_sql(
                    "SELECT id,username,is_admin,disabled FROM users ORDER BY username"
                ).mappings()
            ]

    @app.post(prefix + "/users")
    def create_user(body: NewAccount, s=Depends(session)):
        username = text(body.username, maximum=64, required=True)
        if len(username) < 3:
            raise ValueError("Имя пользователя должно содержать минимум 3 символа")
        with s["store"].transaction() as c:
            require_admin(s, c)
            user = str(uuid.uuid4())
            try:
                c.exec_driver_sql(
                    "INSERT INTO users(id,username,password_hash) VALUES(?,?,?)",
                    (user, username, hasher.hash(body.password)),
                )
            except IntegrityError:
                raise Conflict("Такое имя пользователя уже занято") from None
            audit(c, s["user_id"], user, "account_create", {"username": username})
        return {"id": user, "username": username, "is_admin": False, "disabled": False}

    @app.patch(prefix + "/users/{user_id}")
    def change_user(user_id: str, body: AccountChange, s=Depends(session)):
        user_id = uid(user_id)
        with s["store"].transaction() as c:
            require_admin(s, c)
            row = c.exec_driver_sql("SELECT id FROM users WHERE id=?", (user_id,)).first()
            if not row:
                raise Denied("Пользователь недоступен")
            if user_id == s["user_id"]:
                raise ValueError(
                    "Измените свой пароль в личных настройках; отключение собственного администратора запрещено"
                )
            if body.disabled is not None:
                c.exec_driver_sql(
                    "UPDATE users SET disabled=? WHERE id=?", (int(body.disabled), user_id)
                )
            if body.password is not None:
                c.exec_driver_sql(
                    "UPDATE users SET password_hash=? WHERE id=?",
                    (hasher.hash(body.password), user_id),
                )
            c.exec_driver_sql("DELETE FROM sessions WHERE user_id=?", (user_id,))
            if body.password is not None or body.disabled is True:
                revoke_user(c, user_id)
            audit(
                c,
                s["user_id"],
                user_id,
                "account_update",
                {"disabled": body.disabled, "password_reset": body.password is not None},
            )
        return {"ok": True}

    @app.post(prefix + "/password")
    def password(body: PasswordChange, request: Request, s=Depends(session)):
        throttle(request, "password", 10)
        if s["demo"]:
            raise Denied("Пароль демо-сеанса изменить нельзя")
        with s["store"].transaction() as c:
            row = c.exec_driver_sql(
                "SELECT password_hash FROM users WHERE id=? AND disabled=0", (s["user_id"],)
            ).first()
            try:
                if not row:
                    raise Denied("Учётная запись отключена")
                hasher.verify(row[0], body.current_password)
            except (VerificationError, InvalidHashError):
                raise HTTPException(401, "Неверный текущий пароль") from None
            c.exec_driver_sql(
                "UPDATE users SET password_hash=? WHERE id=?",
                (hasher.hash(body.password), s["user_id"]),
            )
            c.exec_driver_sql("DELETE FROM sessions WHERE user_id=?", (s["user_id"],))
            revoke_user(c, s["user_id"])
            audit(c, s["user_id"], s["user_id"], "password_change", {})
        return login_response(s["user_id"], s["username"])

    @app.get(prefix + "/vehicles/{vehicle_id}/access")
    def access_list(vehicle_id: str, s=Depends(session)):
        with s["store"].transaction() as c:
            car, _ = vehicle_access(c, uid(vehicle_id), s["user_id"], write=True)
            members = [
                dict(r)
                for r in c.exec_driver_sql(
                    "SELECT user_id,role,username,disabled FROM vehicle_access JOIN users ON users.id=vehicle_access.user_id WHERE vehicle_id=?",
                    (car["id"],),
                ).mappings()
            ]
            original = (
                c.exec_driver_sql(
                    "SELECT id AS user_id,username FROM users WHERE id=?", (car["owner_id"],)
                )
                .mappings()
                .first()
            )
            # Car owners need an account picker without password/admin/private data.
            candidates = [
                dict(r)
                for r in c.exec_driver_sql(
                    "SELECT id,username FROM users WHERE disabled=0 ORDER BY username"
                ).mappings()
            ]
            return {"original_owner": dict(original), "members": members, "candidates": candidates}

    def set_access(vehicle_id, user_id, role, s):
        with s["store"].transaction() as c:
            car, _ = vehicle_access(c, uid(vehicle_id), s["user_id"], write=True)
            user_id = uid(user_id)
            if user_id == car["owner_id"]:
                raise ValueError("Доступ исходного владельца нельзя изменить")
            user = c.exec_driver_sql(
                "SELECT id FROM users WHERE id=? AND disabled=0", (user_id,)
            ).first()
            if not user and role is not None:
                raise Denied("Пользователь отсутствует или отключён")
            if role is None:
                c.exec_driver_sql(
                    "DELETE FROM vehicle_access WHERE vehicle_id=? AND user_id=?",
                    (car["id"], user_id),
                )
            else:
                if role not in {"owner", "driver"}:
                    raise ValueError("Неизвестная роль")
                c.exec_driver_sql(
                    "INSERT INTO vehicle_access(vehicle_id,user_id,role) VALUES(?,?,?) ON CONFLICT(vehicle_id,user_id) DO UPDATE SET role=excluded.role",
                    (car["id"], user_id, role),
                )
            audit(c, s["user_id"], car["id"], "access_change", {"user_id": user_id, "role": role})
        return {"ok": True}

    @app.put(prefix + "/vehicles/{vehicle_id}/access/{user_id}")
    def grant(vehicle_id: str, user_id: str, body: Grant, s=Depends(session)):
        return set_access(vehicle_id, user_id, body.role, s)

    @app.delete(prefix + "/vehicles/{vehicle_id}/access/{user_id}")
    def revoke(vehicle_id: str, user_id: str, s=Depends(session)):
        return set_access(vehicle_id, user_id, None, s)
