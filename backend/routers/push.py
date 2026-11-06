from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib import push
from lib.auth import current_user, require_admin
from lib.db import db
from models.schemas import User

router = APIRouter()


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    expirationTime: int | float | None = None
    keys: PushKeys


class PushEndpoint(BaseModel):
    endpoint: str


class PushPublicKey(BaseModel):
    public_key: str


class PushTestResult(BaseModel):
    devices: int


@router.get("/push/public-key", response_model=PushPublicKey)
async def public_key():
    return PushPublicKey(public_key=push.PUBLIC_KEY)


@router.post("/push/subscribe")
async def subscribe(body: PushSubscriptionIn, user: User = Depends(current_user)):
    if not body.endpoint.startswith("https://"):
        raise HTTPException(status_code=400, detail="Assinatura inválida")
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"endpoint": body.endpoint, "keys": body.keys.model_dump(), "user_id": user.id, "role": user.role,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/push/unsubscribe")
async def unsubscribe(body: PushEndpoint, user: User = Depends(current_user)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user.id})
    return {"ok": True}


@router.post("/push/test", response_model=PushTestResult)
async def test_push(_: User = Depends(require_admin)):
    n = await push.notify_admins("Techline — teste", "As notificações do celular estão funcionando ✅", "/admin", "test")
    return PushTestResult(devices=n)
