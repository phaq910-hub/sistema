"""In-panel notifications + optional Twilio SMS/WhatsApp (skipped when keys are missing)."""

import logging
import os
import uuid
from datetime import datetime, timezone

import httpx

from lib import push
from lib.db import db

logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def next_number(name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return int(doc["seq"])


async def push_notification(type_: str, title: str, message: str, link: str = "") -> None:
    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "type": type_,
            "title": title,
            "message": message,
            "link": link,
            "read": False,
            "created_at": now_iso(),
        }
    )
    push.schedule(type_, title, message, link)


def _normalize(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return ""
    if phone.strip().startswith("+"):
        return "+" + digits
    if len(digits) in (10, 11):  # Brazilian number without country code
        return "+55" + digits
    return "+" + digits


async def _twilio_send(to: str, body: str, from_: str) -> None:
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not (sid and token and from_ and to):
        return
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(url, data={"To": to, "From": from_, "Body": body}, auth=(sid, token))
            if res.status_code >= 400:
                logger.warning("Twilio send failed (%s): %s", res.status_code, res.text[:300])
    except Exception as exc:  # never break the business flow on a messaging failure
        logger.warning("Twilio send error: %s", exc)


async def send_message(phone: str, body: str, flag: str | None = None) -> None:
    """WhatsApp Web (if connected) first, then Twilio SMS/WhatsApp if configured.
    `flag` names a Company boolean (e.g. "wa_send_tracking") that must be on."""
    if flag and not getattr(await get_company(), flag, True):
        return
    from lib import whatsapp  # local import keeps lib.notify importable standalone

    if await whatsapp.try_send(phone, body):
        return
    to = _normalize(phone)
    if not to:
        return
    sms_from = os.environ.get("TWILIO_FROM_NUMBER", "")
    wa_from = os.environ.get("TWILIO_WHATSAPP_FROM", "")
    if sms_from:
        await _twilio_send(to, body, sms_from)
    if wa_from:
        wa = wa_from if wa_from.startswith("whatsapp:") else f"whatsapp:{wa_from}"
        await _twilio_send(f"whatsapp:{to}", body, wa)


async def get_company():
    from models.resources import Company

    doc = await db.settings.find_one({"_id": "company"}, {"_id": 0})
    return Company(**(doc or {}))


async def notify_owner(body: str) -> None:
    company = await get_company()
    if not company.wa_notify_owner:
        return
    await send_message(company.owner_phone or os.environ.get("OWNER_PHONE", ""), body)
