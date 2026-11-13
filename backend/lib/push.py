"""Web Push (VAPID + pywebpush) to the owner's installed phone app."""

import asyncio
import json
import logging
import os
from urllib.parse import urlsplit

import requests
from pywebpush import WebPushException, webpush

from lib.db import db

logger = logging.getLogger(__name__)

PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:contato@techline.com.br")

# In-app notification types that also ring the admin's phone.
PUSH_TYPES = {"quote_approved", "quote_rejected", "order_done"}


def _send(sub: dict, payload: str) -> int | None:
    """Return the push service status, or None if the request failed."""
    try:
        with requests.Session() as session:
            session.max_redirects = 0
            return webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
                vapid_private_key=PRIVATE_KEY,
                vapid_claims={"sub": SUBJECT},
                ttl=3600,
                timeout=10,
                requests_session=session,
            ).status_code
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status not in (404, 410):
            logger.warning("web push failed (%s)", status)
        return status
    except Exception:
        logger.warning("web push request failed")
        return None


def supported_endpoint(endpoint: str) -> bool:
    try:
        url = urlsplit(endpoint)
        if url.scheme != "https" or url.username is not None or url.port not in (None, 443):
            return False
        host = url.hostname or ""
    except ValueError:
        return False
    return (
        host in {"fcm.googleapis.com", "updates.push.services.mozilla.com"}
        or host.endswith((".push.apple.com", ".notify.windows.com"))
    )


async def _notify(recipients: dict, title: str, body: str, url: str, tag: str) -> int:
    if not PRIVATE_KEY:
        return 0
    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
    sent = 0
    async for sub in db.push_subscriptions.find(recipients, {"_id": 0}):
        if recipients.get("role") == "tech" and not supported_endpoint(sub["endpoint"]):
            continue
        status = await asyncio.to_thread(_send, sub, payload)
        if status in (404, 410):
            await db.push_subscriptions.delete_one({
                "endpoint": sub["endpoint"],
                "user_id": sub["user_id"],
                "updated_at": sub.get("updated_at"),
            })
        elif status is not None and 200 <= status < 300:
            sent += 1
    return sent


async def notify_admins(title: str, body: str, url: str = "/admin", tag: str = "techline") -> int:
    return await _notify({"role": "admin"}, title, body, url, tag)


async def notify_user(user_id: str, role: str, title: str, body: str, url: str, tag: str) -> int:
    return await _notify({"user_id": user_id, "role": role}, title, body, url, tag)


async def notify_order_assignment(order_id: str, technician_id: str) -> None:
    order = await db.service_orders.find_one({
        "id": order_id, "technician_id": technician_id, "status": "atribuida",
    })
    if order:
        await notify_user(
            technician_id, "tech", f"Nova OS #{order['number']}",
            "Você recebeu uma ordem de serviço.", "/tecnico", f"order-assigned-{order_id}",
        )


def schedule(type_: str, title: str, body: str, url: str) -> None:
    if type_ in PUSH_TYPES:
        asyncio.create_task(notify_admins(title, body, url or "/admin", type_))
