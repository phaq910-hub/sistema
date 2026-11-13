import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from lib.auth import require_admin
from lib.dates import today_iso
from lib.db import db
from lib.push import notify_order_assignment
from lib import whatsapp
from lib.notify import get_company, next_number, notify_owner, now_iso, push_notification, send_message
from models.schemas import Quote, QuoteCreate, RejectInput, User

router = APIRouter()
EDITABLE_STATUSES = ("pendente", "aprovado")


def _to_quote(doc: dict) -> Quote:
    q = Quote(**doc)
    q.expired = q.status == "pendente" and q.valid_until < today_iso("America/Sao_Paulo")
    return q


def _totals(body: QuoteCreate) -> tuple[float, float]:
    subtotal = round(sum(i.quantity * i.unit_price for i in body.items), 2)
    return subtotal, round(max(subtotal - body.discount, 0), 2)


async def _get_quote_doc(quote_id: str, *, for_public_view: bool = False) -> dict:
    doc = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not doc or (doc.get("deleted_at") and not (for_public_view and doc["status"] == "aprovado")):
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return doc


def _current_quote(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "status": doc["status"],
        "deleted_at": None,
        "edit_version": doc.get("edit_version"),
        "approval_in_progress": {"$ne": True},
    }


def _quote_changed():
    return HTTPException(status_code=409, detail="O orçamento mudou. Atualize a lista e tente novamente.")


# ---------- admin ----------
@router.get("/quotes", response_model=list[Quote])
async def list_quotes(_: User = Depends(require_admin)):
    docs = await db.quotes.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [_to_quote(d) for d in docs]


@router.post("/quotes", response_model=Quote)
async def create_quote(body: QuoteCreate, _: User = Depends(require_admin)):
    if body.client_id:
        c = await db.clients.find_one({"id": body.client_id})
        if not c:
            raise HTTPException(status_code=400, detail="Cliente inválido")
        body.client_name = body.client_name or c["name"]
        body.client_phone = body.client_phone or c.get("phone", "")
        body.client_email = body.client_email or c.get("email", "")
        body.client_address = body.client_address or c.get("address", "")
    if body.ticket_id and not await db.tickets.find_one({"id": body.ticket_id}):
        raise HTTPException(status_code=400, detail="Chamado inválido")
    tech_name = None
    if body.technician_id:
        tech = await db.users.find_one({"id": body.technician_id, "role": "tech"})
        if not tech:
            raise HTTPException(status_code=400, detail="Técnico inválido")
        tech_name = tech["name"]
    subtotal, total = _totals(body)
    quote = Quote(
        **body.model_dump(),
        id=str(uuid.uuid4()),
        number=await next_number("quote"),
        subtotal=subtotal,
        total=total,
        status="pendente",
        created_at=now_iso(),
        technician_name=tech_name,
    )
    await db.quotes.insert_one(quote.model_dump())
    if body.ticket_id:
        await db.tickets.update_one({"id": body.ticket_id}, {"$set": {"status": "orcamento", "quote_id": quote.id}})
    return quote


@router.put("/quotes/{quote_id}", response_model=Quote)
async def update_quote(quote_id: str, body: QuoteCreate, _: User = Depends(require_admin)):
    doc = await _get_quote_doc(quote_id)
    if doc["status"] not in EDITABLE_STATUSES:
        raise _quote_changed()
    if body.client_id and body.client_id != doc.get("client_id"):
        if not await db.clients.find_one({"id": body.client_id}):
            raise HTTPException(status_code=400, detail="Cliente inválido")

    approved = doc["status"] == "aprovado"
    tech_name = doc.get("technician_name")
    changes = body.model_dump(exclude={"ticket_id"})
    if approved:
        # The OS has its own assignment, which can differ from the original proposal.
        changes.pop("technician_id", None)
        order_filter = {"quote_id": quote_id}
        if doc.get("order_id"):
            order_filter["id"] = doc["order_id"]
        if not await db.service_orders.find_one(order_filter, {"_id": 1}):
            raise HTTPException(status_code=409, detail="A OS vinculada a este orçamento não foi encontrada")
    elif body.technician_id != doc.get("technician_id"):
        tech_name = None
        if body.technician_id:
            tech = await db.users.find_one({"id": body.technician_id, "role": "tech"})
            if not tech:
                raise HTTPException(status_code=400, detail="Técnico inválido")
            tech_name = tech["name"]

    subtotal, total = _totals(body)
    version = (doc.get("edit_version") or 0) + 1
    changes.update(subtotal=subtotal, total=total, technician_name=tech_name, edit_version=version)
    result = await db.quotes.update_one(_current_quote(doc), {"$set": changes})
    if not result.matched_count:
        raise _quote_changed()

    if approved:
        older_version = {"$or": [
            {"quote_edit_version": None},
            {"quote_edit_version": {"$lt": version}},
        ]}
        await db.service_orders.update_one(
            {**order_filter, **older_version},
            {"$set": {
                "client_name": body.client_name,
                "client_phone": body.client_phone,
                "client_address": body.client_address,
                "description": "; ".join(f"{i.quantity:g}x {i.description}" for i in body.items),
                "quote_edit_version": version,
            }},
        )
        await db.finance.update_one(
            {"quote_id": quote_id, "kind": "receber", "paid": False, **older_version},
            {"$set": {
                "amount": total,
                "party": body.client_name,
                "description": f"Orçamento #{doc['number']} — {body.client_name}",
                "quote_edit_version": version,
            }},
        )
    return _to_quote({**doc, **changes})


@router.post("/quotes/{quote_id}/send-whatsapp")
async def send_quote_whatsapp(quote_id: str, request: Request, _: User = Depends(require_admin)):
    q = _to_quote(await _get_quote_doc(quote_id))
    if not q.client_phone:
        raise HTTPException(status_code=400, detail="Cliente sem telefone cadastrado")
    company = await get_company()
    origin = request.headers.get("origin", "")
    text = (
        f"Olá {q.client_name}! Segue o orçamento #{q.number} da {company.name} no valor de "
        f"R$ {q.total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        + f".\n\nPara APROVAR ou RECUSAR, acesse:\n{origin}/orcamento/{q.id}"
    )
    try:
        await whatsapp.send(q.client_phone, text)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await db.quotes.update_one({"id": quote_id}, {"$set": {"sent_at": now_iso()}})
    return {"ok": True}


@router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, _: User = Depends(require_admin)):
    doc = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    if doc["status"] not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Só é possível excluir orçamentos pendentes ou aprovados")
    if not doc.get("deleted_at"):
        result = await db.quotes.update_one(
            _current_quote(doc), {"$set": {"deleted_at": now_iso()}}
        )
        if not result.matched_count:
            raise _quote_changed()
    if doc["status"] == "pendente" and doc.get("ticket_id"):
        await db.tickets.update_one(
            {"id": doc["ticket_id"], "quote_id": quote_id, "status": "orcamento"},
            {"$set": {"status": "aberto"}, "$unset": {"quote_id": ""}},
        )
    return {"ok": True}


# ---------- public (client link) ----------
@router.get("/public/quotes/{quote_id}", response_model=Quote)
async def public_quote(quote_id: str):
    return _to_quote(await _get_quote_doc(quote_id, for_public_view=True))


@router.post("/public/quotes/{quote_id}/approve", response_model=Quote)
async def approve_quote(quote_id: str, request: Request, bg: BackgroundTasks):
    doc = await _get_quote_doc(quote_id)
    quote = _to_quote(doc)
    if quote.status != "pendente":
        raise HTTPException(status_code=400, detail="Este orçamento já foi respondido")
    if quote.expired:
        raise HTTPException(status_code=400, detail="Este orçamento está vencido")

    now = now_iso()
    tech = await db.users.find_one({"id": quote.technician_id, "role": "tech"}) if quote.technician_id else None
    order_id = str(uuid.uuid4())
    order_number = await next_number("order")
    timeline = [{"status": "aberta", "label": "Orçamento aprovado — OS criada", "at": now}]
    if tech:
        timeline.append({"status": "atribuida", "label": f"OS encaminhada para {tech['name']}", "at": now})
    claim = await db.quotes.update_one(
        _current_quote(doc), {"$set": {"approval_in_progress": True}}
    )
    if not claim.matched_count:
        raise _quote_changed()
    try:
        await db.service_orders.insert_one(
            {
                "id": order_id,
                "number": order_number,
                "quote_id": quote.id,
                "quote_number": quote.number,
                "client_name": quote.client_name,
                "client_phone": quote.client_phone,
                "client_address": quote.client_address,
                "description": "; ".join(f"{i.quantity:g}x {i.description}" for i in quote.items),
                "technician_id": tech["id"] if tech else None,
                "technician_name": tech["name"] if tech else None,
                "technician_phone": tech.get("phone", "") if tech else None,
                "status": "atribuida" if tech else "aberta",
                "created_at": now,
                "location": None,
                "trail": [],
                "completion_notes": "",
                "timeline": timeline,
                "ticket_id": quote.ticket_id,
            }
        )
        await db.quotes.update_one(
            {"id": quote_id, "approval_in_progress": True},
            {"$set": {"status": "aprovado", "responded_at": now, "order_id": order_id}},
        )
        if quote.ticket_id:
            await db.tickets.update_one({"id": quote.ticket_id}, {"$set": {"status": "aprovado", "order_id": order_id}})
        await db.finance.insert_one(
            {
                "id": str(uuid.uuid4()),
                "created_at": now,
                "kind": "receber",
                "description": f"Orçamento #{quote.number} — {quote.client_name}",
                "amount": quote.total,
                "due_date": today_iso("America/Sao_Paulo"),
                "category": "Serviços",
                "party": quote.client_name,
                "paid": False,
                "paid_at": None,
                "quote_id": quote.id,
            }
        )
    finally:
        await db.quotes.update_one(
            {"id": quote_id, "approval_in_progress": True},
            {"$unset": {"approval_in_progress": ""}},
        )
    await push_notification(
        "quote_approved",
        f"Orçamento {quote.client_name} APROVADO",
        f"{quote.client_name} aprovou o orçamento. OS #{order_number} criada"
        + (f" e encaminhada para {tech['name']}." if tech else " — atribua um técnico."),
        "/admin/ordens",
    )
    bg.add_task(notify_owner, f"Techline: {quote.client_name} APROVOU o orçamento #{quote.number}. OS #{order_number} criada.")
    if tech:
        bg.add_task(notify_order_assignment, order_id, tech["id"])
    if tech and tech.get("phone"):
        origin = request.headers.get("origin", "")
        bg.add_task(send_message, tech["phone"], f"Techline: nova OS #{order_number} para {quote.client_name}. Acesse {origin}/tecnico", "wa_notify_technician")
    return _to_quote(await _get_quote_doc(quote_id, for_public_view=True))


@router.post("/public/quotes/{quote_id}/reject", response_model=Quote)
async def reject_quote(quote_id: str, body: RejectInput, bg: BackgroundTasks):
    doc = await _get_quote_doc(quote_id)
    quote = _to_quote(doc)
    if quote.status != "pendente":
        raise HTTPException(status_code=400, detail="Este orçamento já foi respondido")
    result = await db.quotes.update_one(
        _current_quote(doc),
        {"$set": {"status": "recusado", "responded_at": now_iso(), "reject_reason": body.reason.strip() or None}},
    )
    if not result.matched_count:
        raise _quote_changed()
    if quote.ticket_id:
        await db.tickets.update_one({"id": quote.ticket_id}, {"$set": {"status": "aberto"}})
    reason = f" Motivo: {body.reason.strip()}" if body.reason.strip() else ""
    await push_notification(
        "quote_rejected", f"Orçamento {quote.client_name} REPROVADO", f"{quote.client_name} recusou o orçamento.{reason}", "/admin"
    )
    bg.add_task(notify_owner, f"Techline: {quote.client_name} RECUSOU o orçamento #{quote.number}.{reason}")
    return _to_quote(await _get_quote_doc(quote_id))
