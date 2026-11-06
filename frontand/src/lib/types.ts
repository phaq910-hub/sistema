// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "admin" | "tech";
export type QuoteStatus = "pendente" | "aprovado" | "recusado";
export type OrderStatus = "aberta" | "atribuida" | "em_deslocamento" | "no_local" | "em_atendimento" | "concluida";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
}

export interface TechnicianCreate {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteCreate {
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  items: QuoteItem[];
  discount: number;
  valid_until: string;
  notes: string;
  technician_id: string | null;
  client_id: string | null;
  ticket_id: string | null;
}

export interface Quote extends QuoteCreate {
  id: string;
  number: number;
  subtotal: number;
  total: number;
  status: QuoteStatus;
  created_at: string;
  responded_at: string | null;
  reject_reason: string | null;
  order_id: string | null;
  technician_name: string | null;
  expired: boolean;
  sent_at: string | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
}

export interface TimelineEvent {
  status: OrderStatus;
  label: string;
  at: string;
}

export interface ServiceOrder {
  id: string;
  number: number;
  quote_id: string;
  quote_number: number;
  client_name: string;
  client_phone: string;
  client_address: string;
  description: string;
  technician_id: string | null;
  technician_name: string | null;
  technician_phone: string | null;
  status: OrderStatus;
  created_at: string;
  started_at: string | null;
  arrived_at: string | null;
  activity_started_at: string | null;
  finished_at: string | null;
  location: GeoPoint | null;
  trail: GeoPoint[];
  completion_notes: string;
  timeline: TimelineEvent[];
  destination: GeoPoint | null;
  distance_km: number | null;
  eta_minutes: number | null;
  eta_source: "rota" | "estimativa" | null;
  signature: string | null;
  signer_name: string | null;
  ticket_id: string | null;
  photo_count: number;
  review_rating: number | null;
}

export interface FinishInput {
  notes: string;
  signer_name: string;
  signature: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
}

// ---------- back-office (backend/models/resources.py) ----------
interface Base {
  id: string;
  created_at: string;
}

export interface ClientCreate { name: string; document: string; phone: string; email: string; address: string; notes: string }
export interface Client extends ClientCreate, Base {}

export interface SupplierCreate { name: string; document: string; phone: string; email: string; category: string; notes: string }
export interface Supplier extends SupplierCreate, Base {}

export interface ProductCreate {
  name: string; sku: string; category: string; unit: string; quantity: number; min_quantity: number; cost: number; price: number; supplier_id: string | null;
}
export interface Product extends ProductCreate, Base { supplier_name: string | null }

export interface CatalogItemCreate { name: string; description: string; kind: "servico" | "produto"; price: number }
export interface CatalogItem extends CatalogItemCreate, Base {}

export interface FinanceEntryCreate {
  kind: "pagar" | "receber"; description: string; amount: number; due_date: string; category: string; party: string; paid: boolean; quote_id: string | null;
}
export interface FinanceEntry extends FinanceEntryCreate, Base { paid_at: string | null }

export type TicketStatus = "aberto" | "orcamento" | "aprovado" | "em_execucao" | "concluido" | "cancelado";
export type TicketPriority = "baixa" | "media" | "alta";
export interface TicketCreate { client_id: string; title: string; description: string; priority: TicketPriority; scheduled_date: string | null }
export interface Ticket extends TicketCreate, Base {
  number: number; client_name: string; client_phone: string; client_address: string; status: TicketStatus; quote_id: string | null; order_id: string | null;
}

export interface Company {
  name: string; tagline: string; document: string; phone: string; email: string; address: string; logo: string | null;
  pix_key: string; pix_key_type: string; pix_holder: string; owner_phone: string;
  wa_notify_owner: boolean; wa_send_tracking: boolean; wa_notify_technician: boolean;
}
export type PublicCompany = Omit<Company, "owner_phone" | "wa_notify_owner" | "wa_send_tracking" | "wa_notify_technician">;

export interface WhatsAppStatus {
  status: "offline" | "disconnected" | "connecting" | "qr" | "connected";
  qr: string | null;
  me: { id?: string; name?: string } | null;
  error: string | null;
}

export interface PhotoCreate { kind: "antes" | "depois"; image: string; caption: string }
export interface OrderPhoto extends PhotoCreate { id: string; order_id: string; created_at: string }

export interface ReviewCreate { rating: number; comment: string }
export interface Review extends ReviewCreate {
  id: string; order_id: string; order_number: number; client_name: string; technician_name: string | null; created_at: string;
}

export interface TeamMember {
  id: string; name: string; phone: string; last_location: GeoPoint | null;
  active_order_id: string | null; active_order_number: number | null; active_order_status: OrderStatus | null; active_client_name: string | null;
}

export interface TodayInfo { today: string }
export interface StaffUpdate { name: string; phone: string; password: string }
