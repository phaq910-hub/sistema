"""Password hashing, JWT session cookie and role dependencies."""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response

from lib.db import db
from models.schemas import User

COOKIE = "techline_session"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
TTL_DAYS = 7


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(check, digest)


def set_session(response: Response, user_id: str) -> None:
    token = jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=TTL_DAYS)},
        JWT_SECRET,
        algorithm="HS256",
    )
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", max_age=TTL_DAYS * 86400, path="/")


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


async def current_user(request: Request) -> User:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    doc = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return User(**doc)


async def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user


async def require_tech(user: User = Depends(current_user)) -> User:
    if user.role != "tech":
        raise HTTPException(status_code=403, detail="Acesso restrito a técnicos")
    return user
