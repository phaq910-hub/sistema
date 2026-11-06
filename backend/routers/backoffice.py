import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user, hash_password, require_admin, verify_password
from lib.crud import crud_router
from lib.dates import today_iso
from lib.db import db
from lib import whatsapp
from lib.notify import get_company, now_iso
from models.resources import (
    CatalogItem, CatalogItemCreate, Client, ClientCreate, Company, FinanceEntry, FinanceEntryCreate,
    PasswordChange, Product, ProductCreate, PublicCompany, Review, StaffCreate, StaffUpdate, StockAdjust,
    Supplier, SupplierCreate, TeamMember, TodayInfo, WhatsAppSend, WhatsAppStatus,
)
from models.schemas import User

router = APIRouter()


async def _product_enrich(doc: dict) -> dict:
    sup = await db.suppliers.find_one({"id": doc.get("supplier_id")}) if doc.get("supplier_id") else None
    return {**doc, "supplier_name": sup["name"] if sup else None}


async def _finance_enrich(doc: dict) -> dict:
    if doc.get("paid") and not doc.get("paid_at"):
        doc["paid_at"] = now_iso()
    if not doc.get("paid"):
        doc["paid_at"] = None
    return doc


router.include_router(crud_router("clients", "clients", ClientCreate, Client))
router.include_router(crud_router("suppliers", "suppliers", SupplierCreate, Supplier))
router.include_router(crud_router("products", "products", ProductCreate, Product, enrich=_product_enrich))
router.include_router(crud_router("catalog", "catalog", CatalogItemCreate, CatalogItem))
router.include_router(crud_router("finance", "finance", FinanceEntryCreate, FinanceEntry, sort=("due_date", 1), enrich=_finance_enrich))


@router.post("/products/{item_id}/adjust", response_model=Product)
async def adjust_stock(item_id: str, body: StockAdjust, _: User = Depends(require_admin)):
    res = await db.products.find_one_and_update(
        {"id": item_id}, {"$inc": {"quantity": body.delta}}, projection={"_id": 0}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return Product(**await _product_enrich(res))


@router.post("/finance/{item_id}/toggle-paid", response_model=FinanceEntry)
async def toggle_paid(item_id: str, _: User = Depends(require_admin)):
    doc = await db.finance.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    paid = not doc.get("paid")
    await db.finance.update_one({"id": item_id}, {"$set": {"paid": paid, "paid_at": now_iso() if paid else None}})
    return FinanceEntry(**{**doc, "paid": paid, "paid_at": now_iso() if paid else None})


# ---------- empresa ----------
@router.get("/company", response_model=Company)
async def read_company(_: User = Depends(require_admin)):
    return await get_company()


@router.put("/company", response_model=Company)
async def save_company(body: Company, _: User = Depends(require_admin)):
    if body.logo and len(body.logo) > 1_500_000:
        raise HTTPException(status_code=400, detail="Logo muito grande")
    await db.settings.update_one({"_id": "company"}, {"$set": body.model_dump()}, upsert=True)
    return body


@router.get("/public/company", response_model=PublicCompany)
async def public_company():
    return PublicCompany(**(await get_company()).model_dump())


@router.get("/meta/today", response_model=TodayInfo)
async def today():
    return TodayInfo(today=today_iso("America/Sao_Paulo"))


# ---------- whatsapp ----------
@router.get("/whatsapp/status", response_model=WhatsAppStatus)
async def wa_status(_: User = Depends(require_admin)):
    return WhatsAppStatus(**await whatsapp.status())


@router.post("/whatsapp/connect", response_model=WhatsAppStatus)
async def wa_connect(_: User = Depends(require_admin)):
    try:
        await whatsapp.connect()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc) or "Serviço de WhatsApp indisponível")
    return WhatsAppStatus(**await whatsapp.status())


@router.post("/whatsapp/logout", response_model=WhatsAppStatus)
async def wa_logout(_: User = Depends(require_admin)):
    try:
        await whatsapp.logout()
    except Exception:
        pass
    return WhatsAppStatus(**await whatsapp.status())


@router.post("/whatsapp/send")
async def wa_send(body: WhatsAppSend, _: User = Depends(require_admin)):
    try:
        await whatsapp.send(body.phone, body.text)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


# ---------- equipe / avaliações ----------
@router.get("/team/locations", response_model=list[TeamMember])
async def team_locations(_: User = Depends(require_admin)):
    techs = await db.users.find({"role": "tech"}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(500)
    active = await db.service_orders.find(
        {"status": {"$in": ["em_deslocamento", "no_local", "em_atendimento"]}}, {"_id": 0, "id": 1, "number": 1, "status": 1, "technician_id": 1, "client_name": 1}
    ).to_list(500)
    by_tech = {o["technician_id"]: o for o in active}
    out = []
    for t in techs:
        o = by_tech.get(t["id"])
        out.append(TeamMember(
            id=t["id"], name=t["name"], phone=t.get("phone", ""), last_location=t.get("last_location"),
            active_order_id=o["id"] if o else None, active_order_number=o["number"] if o else None,
            active_order_status=o["status"] if o else None, active_client_name=o["client_name"] if o else None,
        ))
    return out


@router.get("/reviews", response_model=list[Review])
async def list_reviews(_: User = Depends(require_admin)):
    docs = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Review(**d) for d in docs]


# ---------- funcionários (admins) / técnicos / conta ----------
@router.get("/staff", response_model=list[User])
async def list_staff(_: User = Depends(require_admin)):
    docs = await db.users.find({"role": "admin"}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(500)
    return [User(**d) for d in docs]


@router.post("/staff", response_model=User)
async def create_staff(body: StaffCreate, _: User = Depends(require_admin)):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Já existe um usuário com este e-mail")
    user = User(id=str(uuid.uuid4()), name=body.name.strip(), email=email, role="admin", phone=body.phone)
    await db.users.insert_one({**user.model_dump(), "password_hash": hash_password(body.password)})
    return user


@router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, body: StaffUpdate, _: User = Depends(require_admin)):
    data: dict = {"name": body.name.strip(), "phone": body.phone}
    if body.password:
        if len(body.password) < 4:
            raise HTTPException(status_code=400, detail="Senha deve ter ao menos 4 caracteres")
        data["password_hash"] = hash_password(body.password)
    res = await db.users.find_one_and_update({"id": user_id}, {"$set": data}, projection={"_id": 0, "password_hash": 0}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return User(**res)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, me: User = Depends(require_admin)):
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir o seu próprio acesso")
    res = await db.users.delete_one({"id": user_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True}


@router.post("/auth/password")
async def change_password(body: PasswordChange, me: User = Depends(current_user)):
    doc = await db.users.find_one({"id": me.id})
    if not doc or not verify_password(body.current, doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    await db.users.update_one({"id": me.id}, {"$set": {"password_hash": hash_password(body.new)}})
    return {"ok": True}
