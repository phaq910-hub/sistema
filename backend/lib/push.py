"""Web Push (VAPID + pywebpush) to the owner's installed phone app."""

import asyncio
import json
import logging
import os

from pywebpush import WebPushException, webpush

from lib.db import db

logger = logging.getLogger(__name__)

PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:contato@techline.com.br")

# In-app notification types that also ring the admin's phone.
PUSH_TYPES = {"quote_approved", "quote_rejected", "order_done"}


def _send(sub: dict, payload: str) -> int | None:
    """Returns the HTTP status for a dead subscription (404/410), else None."""
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=payload,
            vapid_private_key=PRIVATE_KEY,
            vapid_claims={"sub": SUBJECT},
            ttl=3600,
        )
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            return status
        logger.warning("web push failed (%s)", status)
    return None


async def notify_admins(title: str, body: str, url: str = "/admin", tag: str = "techline") -> int:
    """Sends to every admin device; prunes expired subscriptions. Returns devices reached."""
    if not PRIVATE_KEY:
        return 0
    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
    sent = 0
    async for sub in db.push_subscriptions.find({"role": "admin"}, {"_id": 0}):
        dead = await asyncio.to_thread(_send, sub, payload)
        if dead:
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
        else:
            sent += 1
    return sent


def schedule(type_: str, title: str, body: str, url: str) -> None:
    if type_ in PUSH_TYPES:
        asyncio.create_task(notify_admins(title, body, url or "/admin", type_))
