import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.db import db
from lib.notify import next_number, now_iso
from models.resources import Ticket, TicketCreate, TicketStatusInput
from models.schemas import User

router = APIRouter()


async def _client(client_id: str) -> dict:
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=400, detail="Cliente inválido")
    return c


@router.get("/tickets", response_model=list[Ticket])
async def list_tickets(_: User = Depends(require_admin)):
    docs = await db.tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return [Ticket(**d) for d in docs]


@router.post("/tickets", response_model=Ticket)
async def create_ticket(body: TicketCreate, _: User = Depends(require_admin)):
    c = await _client(body.client_id)
    t = Ticket(
        **body.model_dump(), id=str(uuid.uuid4()), created_at=now_iso(), number=await next_number("ticket"),
        client_name=c["name"], client_phone=c.get("phone", ""), client_address=c.get("address", ""),
    )
    await db.tickets.insert_one(t.model_dump())
    return t


@router.put("/tickets/{ticket_id}", response_model=Ticket)
async def update_ticket(ticket_id: str, body: TicketCreate, _: User = Depends(require_admin)):
    c = await _client(body.client_id)
    data = {**body.model_dump(), "client_name": c["name"], "client_phone": c.get("phone", ""), "client_address": c.get("address", "")}
    res = await db.tickets.find_one_and_update({"id": ticket_id}, {"$set": data}, projection={"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    return Ticket(**res)


@router.post("/tickets/{ticket_id}/status", response_model=Ticket)
async def set_ticket_status(ticket_id: str, body: TicketStatusInput, _: User = Depends(require_admin)):
    res = await db.tickets.find_one_and_update({"id": ticket_id}, {"$set": {"status": body.status}}, projection={"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    return Ticket(**res)


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, _: User = Depends(require_admin)):
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    if t.get("order_id"):
        raise HTTPException(status_code=400, detail="Chamado com OS não pode ser excluído — cancele-o")
    await db.tickets.delete_one({"id": ticket_id})
    return {"ok": True}
