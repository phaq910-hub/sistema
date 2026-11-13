import { ApiError } from "./api";
import type { OrderStatus, QuoteStatus, TicketPriority, TicketStatus } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number) => brl.format(v);

export function dateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  // plain YYYY-MM-DD dates are calendar dates, not instants
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function dateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function timeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function errorMessage(err: unknown, fallback = "Algo deu errado"): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    if (body && Array.isArray(body.detail)) return "Verifique os campos preenchidos";
  }
  return fallback;
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  recusado: { label: "Recusado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  aberta: { label: "Aguardando técnico", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  atribuida: { label: "Atribuída", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  em_deslocamento: { label: "A caminho", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  no_local: { label: "Chegou ao local", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  em_atendimento: { label: "Em atendimento", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  concluida: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

export const publicUrl = (path: string) => `${window.location.origin}${path}`;

export function whatsappLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export const TICKET_STATUS: Record<TicketStatus, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  orcamento: { label: "Orçamento enviado", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  em_execucao: { label: "Em execução", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  concluido: { label: "Concluído", cls: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40" },
  cancelado: { label: "Cancelado", cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

export const PRIORITY: Record<TicketPriority, { label: string; cls: string }> = {
  baixa: { label: "Baixa", cls: "text-slate-400" },
  media: { label: "Média", cls: "text-amber-300" },
  alta: { label: "Alta", cls: "text-red-400" },
};

export const monthKey = (iso: string) => iso.slice(0, 7);
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
