"""Pydantic models for the back-office resources — mirrored in frontend/src/lib/types.ts."""

from typing import Literal

from pydantic import BaseModel, Field


class Base(BaseModel):
    id: str
    created_at: str


# ---------- clientes ----------
class ClientCreate(BaseModel):
    name: str = Field(min_length=1)
    document: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    notes: str = ""


class Client(ClientCreate, Base):
    pass


# ---------- fornecedores ----------
class SupplierCreate(BaseModel):
    name: str = Field(min_length=1)
    document: str = ""
    phone: str = ""
    email: str = ""
    category: str = ""
    notes: str = ""


class Supplier(SupplierCreate, Base):
    pass


# ---------- estoque ----------
class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    sku: str = ""
    category: str = ""
    unit: str = "un"
    quantity: float = 0
    min_quantity: float = 0
    cost: float = Field(default=0, ge=0)
    price: float = Field(default=0, ge=0)
    supplier_id: str | None = None


class Product(ProductCreate, Base):
    supplier_name: str | None = None


class StockAdjust(BaseModel):
    delta: float


# ---------- catálogo ----------
class CatalogItemCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    kind: Literal["servico", "produto"] = "servico"
    price: float = Field(default=0, ge=0)


class CatalogItem(CatalogItemCreate, Base):
    pass


# ---------- financeiro ----------
class FinanceEntryCreate(BaseModel):
    kind: Literal["pagar", "receber"]
    description: str = Field(min_length=1)
    amount: float = Field(gt=0)
    due_date: str  # YYYY-MM-DD
    category: str = ""
    party: str = ""  # fornecedor / cliente
    paid: bool = False
    quote_id: str | None = None


class FinanceEntry(FinanceEntryCreate, Base):
    paid_at: str | None = None


# ---------- chamados ----------
TicketStatus = Literal["aberto", "orcamento", "aprovado", "em_execucao", "concluido", "cancelado"]


class TicketCreate(BaseModel):
    client_id: str
    title: str = Field(min_length=1)
    description: str = ""
    priority: Literal["baixa", "media", "alta"] = "media"
    scheduled_date: str | None = None  # YYYY-MM-DD


class Ticket(TicketCreate, Base):
    number: int
    client_name: str
    client_phone: str = ""
    client_address: str = ""
    status: TicketStatus = "aberto"
    quote_id: str | None = None
    order_id: str | None = None


class TicketStatusInput(BaseModel):
    status: TicketStatus


# ---------- empresa ----------
class Company(BaseModel):
    name: str = "Techline Consultoria"
    tagline: str = "Assistência Técnica"
    document: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    logo: str | None = None  # data URL
    pix_key: str = ""
    pix_key_type: str = ""
    pix_holder: str = ""
    owner_phone: str = ""
    wa_notify_owner: bool = True
    wa_send_tracking: bool = True
    wa_notify_technician: bool = True


class PublicCompany(BaseModel):
    name: str
    tagline: str
    phone: str
    email: str
    address: str
    document: str
    logo: str | None = None
    pix_key: str
    pix_key_type: str
    pix_holder: str


# ---------- whatsapp ----------
class WhatsAppStatus(BaseModel):
    status: Literal["offline", "disconnected", "connecting", "qr", "connected"]
    qr: str | None = None
    me: dict | None = None
    error: str | None = None


class WhatsAppSend(BaseModel):
    phone: str = Field(min_length=8)
    text: str = Field(min_length=1)


# ---------- fotos / avaliações / equipe ----------
class PhotoCreate(BaseModel):
    kind: Literal["antes", "depois"]
    image: str = Field(min_length=50, max_length=3_000_000)  # data URL (jpeg)
    caption: str = ""


class OrderPhoto(PhotoCreate):
    id: str
    order_id: str
    created_at: str


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""


class Review(ReviewCreate):
    id: str
    order_id: str
    order_number: int
    client_name: str
    technician_name: str | None = None
    created_at: str


class TeamMember(BaseModel):
    id: str
    name: str
    phone: str = ""
    last_location: dict | None = None
    active_order_id: str | None = None
    active_order_number: int | None = None
    active_order_status: str | None = None
    active_client_name: str | None = None


class TodayInfo(BaseModel):
    today: str


class StaffCreate(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=4)
    phone: str = ""


class StaffUpdate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = ""
    password: str = ""  # empty = keep


class PasswordChange(BaseModel):
    current: str
    new: str = Field(min_length=4)
