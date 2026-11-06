from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from datetime import datetime, timezone

from lib.auth import require_admin, require_tech
from lib.db import db
from lib.geo import geocode, road_route, straight_estimate
import uuid

from lib.notify import get_company, now_iso, push_notification, send_message
from models.resources import OrderPhoto, PhotoCreate, Review, ReviewCreate
from models.schemas import AssignInput, FinishInput, LocationInput, ServiceOrder, User

LIST_PROJECTION = {"_id": 0, "trail": 0, "signature": 0}
ROUTE_REFRESH_S = 30  # public OSRM: refresh road ETA at most every 30s per OS

router = APIRouter()


async def _get_order(order_id: str) -> dict:
    doc = await db.service_orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    return doc


async def _owned(order_id: str, user: User) -> dict:
    doc = await _get_order(order_id)
    if doc.get("technician_id") != user.id:
        raise HTTPException(status_code=403, detail="Esta OS não está atribuída a você")
    return doc


def _event(status: str, label: str) -> dict:
    return {"status": status, "label": label, "at": now_iso()}


# ---------- admin ----------
@router.get("/orders", response_model=list[ServiceOrder])
async def list_orders(_: User = Depends(require_admin)):
    docs = await db.service_orders.find({}, LIST_PROJECTION).sort("created_at", -1).to_list(1000)
    return [ServiceOrder(**d) for d in docs]


@router.post("/orders/{order_id}/assign", response_model=ServiceOrder)
async def assign_order(order_id: str, body: AssignInput, request: Request, bg: BackgroundTasks, _: User = Depends(require_admin)):
    order = await _get_order(order_id)
    if order["status"] in ("em_deslocamento", "no_local", "em_atendimento", "concluida"):
        raise HTTPException(status_code=400, detail="OS já iniciada — não é possível reatribuir")
    tech = await db.users.find_one({"id": body.technician_id, "role": "tech"})
    if not tech:
        raise HTTPException(status_code=400, detail="Técnico inválido")
    await db.service_orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "technician_id": tech["id"],
                "technician_name": tech["name"],
                "technician_phone": tech.get("phone", ""),
                "status": "atribuida",
            },
            "$push": {"timeline": _event("atribuida", f"OS encaminhada para {tech['name']}")},
        },
    )
    if tech.get("phone"):
        origin = request.headers.get("origin", "")
        bg.add_task(send_message, tech["phone"], f"Techline: nova OS #{order['number']} para {order['client_name']}. Acesse {origin}/tecnico", "wa_notify_technician")
    return ServiceOrder(**await _get_order(order_id))


# ---------- technician ----------
@router.get("/tech/orders", response_model=list[ServiceOrder])
async def my_orders(user: User = Depends(require_tech)):
    docs = await db.service_orders.find({"technician_id": user.id}, LIST_PROJECTION).sort("created_at", -1).to_list(500)
    return [ServiceOrder(**d) for d in docs]


@router.post("/orders/{order_id}/start", response_model=ServiceOrder)
async def start_order(order_id: str, request: Request, bg: BackgroundTasks, user: User = Depends(require_tech)):
    order = await _owned(order_id, user)
    if order["status"] != "atribuida":
        raise HTTPException(status_code=400, detail="OS não pode ser iniciada neste status")
    dest = order.get("destination") or await geocode(order.get("client_address", ""))
    if dest:
        dest = {**dest, "updated_at": dest.get("updated_at") or now_iso()}
    await db.service_orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": "em_deslocamento", "started_at": now_iso(), "destination": dest},
            "$push": {"timeline": _event("em_deslocamento", f"{user.name} iniciou o deslocamento")},
        },
    )
    await push_notification(
        "order_started", f"OS #{order['number']} iniciada", f"{user.name} está a caminho de {order['client_name']}.", "/admin/ordens"
    )
    if order.get("ticket_id"):
        await db.tickets.update_one({"id": order["ticket_id"]}, {"$set": {"status": "em_execucao"}})
    if order.get("client_phone"):
        origin = request.headers.get("origin", "")
        company = await get_company()
        bg.add_task(
            send_message,
            order["client_phone"],
            f"Olá {order['client_name']}! Aqui é da {company.name}. O técnico {user.name} recebeu a sua OS #{order['number']} "
            f"e já está a caminho. Acompanhe em tempo real onde ele está:\n{origin}/rastreamento/{order_id}",
            "wa_send_tracking",
        )
    return ServiceOrder(**await _get_order(order_id))


@router.post("/orders/{order_id}/arrive", response_model=ServiceOrder)
async def arrive_order(order_id: str, bg: BackgroundTasks, user: User = Depends(require_tech)):
    order = await _owned(order_id, user)
    if order["status"] != "em_deslocamento":
        raise HTTPException(status_code=400, detail="OS não está em deslocamento")
    await db.service_orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": "no_local", "arrived_at": now_iso(), "eta_minutes": 0},
            "$push": {"timeline": _event("no_local", f"{user.name} chegou ao local")},
        },
    )
    if order.get("client_phone"):
        company = await get_company()
        bg.add_task(
            send_message,
            order["client_phone"],
            f"Olá {order['client_name']}! O técnico {user.name} da {company.name} acabou de chegar ao local "
            f"para o atendimento da OS #{order['number']}. 📍",
            "wa_send_tracking",
        )
    return ServiceOrder(**await _get_order(order_id))


@router.post("/orders/{order_id}/begin", response_model=ServiceOrder)
async def begin_activity(order_id: str, user: User = Depends(require_tech)):
    order = await _owned(order_id, user)
    if order["status"] != "no_local":
        raise HTTPException(status_code=400, detail="Registre a chegada ao local antes de iniciar a atividade")
    await db.service_orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": "em_atendimento", "activity_started_at": now_iso()},
            "$push": {"timeline": _event("em_atendimento", f"{user.name} iniciou a atividade")},
        },
    )
    return ServiceOrder(**await _get_order(order_id))


@router.post("/orders/{order_id}/finish", response_model=ServiceOrder)
async def finish_order(order_id: str, body: FinishInput, request: Request, bg: BackgroundTasks, user: User = Depends(require_tech)):
    order = await _owned(order_id, user)
    if order["status"] != "em_atendimento":
        raise HTTPException(status_code=400, detail="Inicie a atividade antes de finalizar a OS")
    if not body.signature.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=400, detail="Assinatura inválida")
    await db.service_orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "status": "concluida",
                "finished_at": now_iso(),
                "completion_notes": body.notes.strip(),
                "signature": body.signature,
                "signer_name": body.signer_name.strip(),
                "eta_minutes": None,
            },
            "$push": {"timeline": _event("concluida", "Serviço concluído")},
        },
    )
    await push_notification(
        "order_done", f"OS #{order['number']} concluída", f"{user.name} concluiu o atendimento de {order['client_name']}.", "/admin/ordens"
    )
    if order.get("ticket_id"):
        await db.tickets.update_one({"id": order["ticket_id"]}, {"$set": {"status": "concluido"}})
    if order.get("client_phone"):
        origin = request.headers.get("origin", "")
        company = await get_company()
        bg.add_task(
            send_message,
            order["client_phone"],
            f"Olá {order['client_name']}! O serviço da OS #{order['number']} foi concluído por {user.name}. ✅\n\n"
            f"Veja a sua Ordem de Serviço assinada (com fotos e comprovante):\n{origin}/recibo/{order_id}\n\n"
            f"Avalie o atendimento: {origin}/rastreamento/{order_id}\n\nObrigado por escolher a {company.name}!",
            "wa_send_tracking",
        )
    return ServiceOrder(**await _get_order(order_id))


# ---------- fotos antes/depois ----------
@router.get("/orders/{order_id}/photos", response_model=list[OrderPhoto])
async def list_photos(order_id: str):
    """Public (tracking / receipt pages show them); the OS id is an unguessable UUID."""
    docs = await db.order_photos.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [OrderPhoto(**d) for d in docs]


@router.post("/orders/{order_id}/photos", response_model=OrderPhoto)
async def add_photo(order_id: str, body: PhotoCreate, user: User = Depends(require_tech)):
    await _owned(order_id, user)
    if not body.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Imagem inválida")
    if await db.order_photos.count_documents({"order_id": order_id}) >= 20:
        raise HTTPException(status_code=400, detail="Limite de 20 fotos por OS")
    photo = OrderPhoto(**body.model_dump(), id=str(uuid.uuid4()), order_id=order_id, created_at=now_iso())
    await db.order_photos.insert_one(photo.model_dump())
    await db.service_orders.update_one({"id": order_id}, {"$inc": {"photo_count": 1}})
    return photo


@router.delete("/orders/{order_id}/photos/{photo_id}")
async def delete_photo(order_id: str, photo_id: str, user: User = Depends(require_tech)):
    await _owned(order_id, user)
    res = await db.order_photos.delete_one({"id": photo_id, "order_id": order_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    await db.service_orders.update_one({"id": order_id}, {"$inc": {"photo_count": -1}})
    return {"ok": True}


# ---------- avaliação do cliente ----------
@router.get("/public/orders/{order_id}/review", response_model=Review | None)
async def get_review(order_id: str):
    doc = await db.reviews.find_one({"order_id": order_id}, {"_id": 0})
    return Review(**doc) if doc else None


@router.post("/public/orders/{order_id}/review", response_model=Review)
async def create_review(order_id: str, body: ReviewCreate):
    order = await _get_order(order_id)
    if order["status"] != "concluida":
        raise HTTPException(status_code=400, detail="Avalie após a conclusão do serviço")
    if await db.reviews.find_one({"order_id": order_id}):
        raise HTTPException(status_code=400, detail="Este atendimento já foi avaliado")
    review = Review(
        **body.model_dump(), id=str(uuid.uuid4()), order_id=order_id, order_number=order["number"],
        client_name=order["client_name"], technician_name=order.get("technician_name"), created_at=now_iso(),
    )
    await db.reviews.insert_one(review.model_dump())
    await db.service_orders.update_one({"id": order_id}, {"$set": {"review_rating": body.rating}})
    await push_notification("review", f"Nova avaliação: {body.rating}★", f"{order['client_name']} avaliou a OS #{order['number']}.", "/admin/avaliacoes")
    return review


@router.post("/orders/{order_id}/location", response_model=ServiceOrder)
async def update_location(order_id: str, body: LocationInput, user: User = Depends(require_tech)):
    order = await _owned(order_id, user)
    if order["status"] not in ("em_deslocamento", "no_local", "em_atendimento"):
        raise HTTPException(status_code=400, detail="GPS só é enviado com a OS em andamento")
    point = {**body.model_dump(), "updated_at": now_iso()}
    updates: dict = {"location": point}
    dest = order.get("destination")
    if dest and order["status"] == "em_deslocamento":
        last = order.get("eta_updated_at")
        stale = not last or (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() > ROUTE_REFRESH_S
        route = await road_route(body.lat, body.lng, dest["lat"], dest["lng"]) if stale else None
        if route:
            updates.update(distance_km=round(route[0], 2), eta_minutes=round(route[1], 1), eta_source="rota", eta_updated_at=now_iso())
        elif stale or order.get("eta_source") != "rota":
            km, minutes = straight_estimate(body.lat, body.lng, dest["lat"], dest["lng"])
            updates.update(distance_km=round(km, 2), eta_minutes=round(minutes, 1), eta_source="estimativa")
    await db.service_orders.update_one(
        {"id": order_id},
        {"$set": updates, "$push": {"trail": {"$each": [point], "$slice": -300}}},
    )
    await db.users.update_one({"id": user.id}, {"$set": {"last_location": point}})
    return ServiceOrder(**await _get_order(order_id))


# ---------- public tracking ----------
@router.get("/public/orders/{order_id}", response_model=ServiceOrder)
async def public_order(order_id: str):
    return ServiceOrder(**await _get_order(order_id))
