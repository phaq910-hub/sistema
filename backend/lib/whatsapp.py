"""Spawns/talks to the Node WhatsApp Web bridge (whatsapp-service/index.js)."""

import asyncio
import logging
import os
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)
SERVICE_DIR = Path(__file__).resolve().parent.parent.parent / "whatsapp-service"
PORT = int(os.environ.get("WA_PORT", "8002"))
BASE = f"http://127.0.0.1:{PORT}"


async def spawn() -> asyncio.subprocess.Process | None:
    if not (SERVICE_DIR / "index.js").exists():
        logger.warning("whatsapp-service not found at %s", SERVICE_DIR)
        return None
    log = open("/tmp/whatsapp-service.log", "ab")
    try:
        return await asyncio.create_subprocess_exec(
            "node", str(SERVICE_DIR / "index.js"), cwd=str(SERVICE_DIR), stdout=log, stderr=log,
            env={**os.environ, "WA_PORT": str(PORT)},
        )
    except Exception as exc:
        logger.warning("could not start whatsapp bridge: %s", exc)
        return None


async def _call(method: str, path: str, json: dict | None = None, timeout: float = 15) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.request(method, BASE + path, json=json)
        data = res.json()
        if res.status_code >= 400:
            raise RuntimeError(data.get("error") or "Falha no WhatsApp")
        return data


async def status() -> dict:
    try:
        return await _call("GET", "/status", timeout=5)
    except Exception:
        return {"status": "offline", "qr": None, "me": None, "error": "Serviço de WhatsApp indisponível"}


async def connect() -> dict:
    return await _call("POST", "/connect")


async def logout() -> dict:
    return await _call("POST", "/logout")


async def send(phone: str, text: str) -> None:
    """Raises RuntimeError with a user-facing message on failure."""
    if not phone:
        raise RuntimeError("Telefone não informado")
    try:
        await _call("POST", "/send", {"phone": phone, "text": text}, timeout=25)
    except httpx.HTTPError:
        raise RuntimeError("Serviço de WhatsApp indisponível")


async def try_send(phone: str, text: str) -> bool:
    try:
        await send(phone, text)
        return True
    except Exception as exc:
        logger.info("whatsapp send skipped: %s", exc)
        return False
