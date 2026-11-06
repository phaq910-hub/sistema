from fastapi import APIRouter, Depends

from lib.auth import require_admin
from lib.db import db
from models.schemas import Notification, NotificationList, User

router = APIRouter()


@router.get("/notifications", response_model=NotificationList)
async def list_notifications(_: User = Depends(require_admin)):
    docs = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    unread = await db.notifications.count_documents({"read": False})
    return NotificationList(items=[Notification(**d) for d in docs], unread=unread)


@router.post("/notifications/read-all")
async def read_all(_: User = Depends(require_admin)):
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}
