from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib import push
from lib.auth import current_user
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
    if not body.endpoint.startswith("https://") or (
        user.role == "tech" and not push.supported_endpoint(body.endpoint)
    ):
        raise HTTPException(status_code=400, detail="Assinatura inválida")
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"endpoint": body.endpoint, "keys": body.keys.model_dump(), "user_id": user.id, "role": user.role,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/push/status")
async def subscription_status(body: PushEndpoint, user: User = Depends(current_user)):
    subscription = await db.push_subscriptions.find_one(
        {"endpoint": body.endpoint, "user_id": user.id, "role": user.role}, {"_id": 1}
    )
    return {"active": subscription is not None}


@router.post("/push/unsubscribe")
async def unsubscribe(body: PushEndpoint, user: User = Depends(current_user)):
    result = await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user.id})
    return {"ok": True, "removed": bool(result.deleted_count)}


@router.post("/push/test", response_model=PushTestResult)
async def test_push(user: User = Depends(current_user)):
    n = await push.notify_user(
        user.id, user.role, "Techline — teste", "As notificações do celular estão funcionando ✅",
        "/tecnico" if user.role == "tech" else "/admin", "test",
    )
    return PushTestResult(devices=n)
