"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts."""

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["admin", "tech"]
QuoteStatus = Literal["pendente", "aprovado", "recusado"]
OrderStatus = Literal["aberta", "atribuida", "em_deslocamento", "no_local", "em_atendimento", "concluida"]


# ---------- auth / users ----------
class LoginInput(BaseModel):
    email: str
    password: str


class User(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    phone: str = ""


class TechnicianCreate(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=4)
    phone: str = ""


# ---------- quotes ----------
class QuoteItem(BaseModel):
    description: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class QuoteCreate(BaseModel):
    client_name: str = Field(min_length=1)
    client_phone: str = ""
    client_email: str = ""
    client_address: str = ""
    items: list[QuoteItem] = Field(min_length=1)
    discount: float = Field(default=0, ge=0)
    valid_until: str  # YYYY-MM-DD
    notes: str = ""
    technician_id: str | None = None
    client_id: str | None = None
    ticket_id: str | None = None


class Quote(QuoteCreate):
    id: str
    number: int
    subtotal: float
    total: float
    status: QuoteStatus
    created_at: str
    responded_at: str | None = None
    reject_reason: str | None = None
    order_id: str | None = None
    technician_name: str | None = None
    expired: bool = False
    sent_at: str | None = None


class RejectInput(BaseModel):
    reason: str = ""


# ---------- service orders ----------
class GeoPoint(BaseModel):
    lat: float
    lng: float
    accuracy: float | None = None
    updated_at: str = ""


class LocationInput(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float | None = None


class TimelineEvent(BaseModel):
    status: OrderStatus
    label: str
    at: str


class ServiceOrder(BaseModel):
    id: str
    number: int
    quote_id: str
    quote_number: int
    client_name: str
    client_phone: str = ""
    client_address: str = ""
    description: str = ""
    technician_id: str | None = None
    technician_name: str | None = None
    technician_phone: str | None = None
    status: OrderStatus
    created_at: str
    started_at: str | None = None
    arrived_at: str | None = None
    activity_started_at: str | None = None
    finished_at: str | None = None
    location: GeoPoint | None = None
    trail: list[GeoPoint] = []
    completion_notes: str = ""
    timeline: list[TimelineEvent] = []
    destination: GeoPoint | None = None
    distance_km: float | None = None
    eta_minutes: float | None = None
    eta_source: Literal["rota", "estimativa"] | None = None
    signature: str | None = None  # PNG data URL
    signer_name: str | None = None
    ticket_id: str | None = None
    photo_count: int = 0
    review_rating: int | None = None


class AssignInput(BaseModel):
    technician_id: str


class FinishInput(BaseModel):
    notes: str = ""
    signer_name: str = Field(min_length=1)
    signature: str = Field(min_length=50, max_length=400_000)


# ---------- notifications ----------
class Notification(BaseModel):
    id: str
    type: str
    title: str
    message: str
    link: str = ""
    read: bool = False
    created_at: str


class NotificationList(BaseModel):
    items: list[Notification]
    unread: int
