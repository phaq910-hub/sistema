import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FilePlus2, Pencil, Trash2, Headset, Ban, CalendarClock, MapPin, User as UserIcon, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/AdminLayout";
import { ClientPicker } from "@/components/ClientPicker";
import { QuoteFormDialog, ShareQuoteDialog } from "@/components/QuoteForm";
import { OrderStatusBadge, TicketStatusBadge } from "@/components/StatusBadge";
import { nativeSelectCls } from "@/components/ResourcePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { dateBR, dateTimeBR, errorMessage, PRIORITY, TICKET_STATUS } from "@/lib/format";
import type { Quote, Ticket, TicketCreate, TicketStatus, TodayInfo } from "@/lib/types";
import { useOrders, useTechs } from "@/pages/admin/Orders";
import { cn } from "@/lib/utils";

export const useTickets = () => useQuery({ queryKey: ["tickets"], queryFn: () => apiGet<Ticket[]>("/tickets"), refetchInterval: 10000 });
export const useToday = () => useQuery({ queryKey: ["today"], queryFn: () => apiGet<TodayInfo>("/meta/today"), staleTime: 300_000 });

const emptyTicket = (): TicketCreate => ({ client_id: "", title: "", description: "", priority: "media", scheduled_date: null });

function TicketDialog({ ticket, open, onOpenChange }: { ticket: Ticket | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TicketCreate>(emptyTicket());
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const key = open ? (ticket?.id ?? null) : undefined;
  if (key !== loadedFor) {
    setLoadedFor(key);
    if (open) setForm(ticket ? { client_id: ticket.client_id, title: ticket.title, description: ticket.description, priority: ticket.priority, scheduled_date: ticket.scheduled_date } : emptyTicket());
  }
  const save = useMutation({
    mutationFn: () => (ticket ? apiPut<Ticket>(`/tickets/${ticket.id}`, form) : apiPost<Ticket>("/tickets", form)),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(ticket ? "Chamado atualizado" : `Chamado #${t.number} aberto`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticket ? `Editar chamado #${ticket.number}` : "Abrir chamado"}</DialogTitle>
          <DialogDescription>Registre a solicitação do cliente. Depois gere o orçamento a partir dele.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Cliente *</Label>
          <ClientPicker value={form.client_id} testPrefix="ticket" onChange={(c) => setForm({ ...form, client_id: c?.id ?? "" })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-title">Assunto *</Label>
          <Input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Manutenção do ar-condicionado" data-testid="ticket-title-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-desc">Descrição</Label>
          <Textarea id="t-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="ticket-description-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-pri">Prioridade</Label>
            <select id="t-pri" className={nativeSelectCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketCreate["priority"] })} data-testid="ticket-priority-select">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-date">Agendar para</Label>
            <Input id="t-date" type="date" value={form.scheduled_date ?? ""} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value || null })} data-testid="ticket-date-input" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="ticket-cancel-button">Cancelar</Button>
          <Button disabled={!form.client_id || !form.title.trim() || save.isPending} onClick={() => save.mutate()} data-testid="ticket-submit-button">
            {save.isPending ? "Salvando…" : "Salvar chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TicketsPage() {
  const qc = useQueryClient();
  const { data: tickets = [] } = useTickets();
  const [filter, setFilter] = useState<TicketStatus | "todos">("todos");
  const [edit, setEdit] = useState<{ open: boolean; ticket: Ticket | null }>({ open: false, ticket: null });
  const [quoteFor, setQuoteFor] = useState<Ticket | null>(null);
  const [share, setShare] = useState<Quote | null>(null);
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: TicketStatus }) => apiPost(`/tickets/${id}/status`, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/tickets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Chamado excluído");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = filter === "todos" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div>
      <PageHeader
        eyebrow="Atendimento"
        title="Chamados"
        description="Cliente → chamado → orçamento → aprovação → OS com técnico → rastreio ao vivo."
        actions={<Button onClick={() => setEdit({ open: true, ticket: null })} data-testid="ticket-new-button"><Plus className="size-4" /> Abrir chamado</Button>}
      />
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          {(["todos", ...Object.keys(TICKET_STATUS)] as (TicketStatus | "todos")[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`tickets-filter-${f}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150",
                filter === f ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "todos" ? `Todos (${tickets.length})` : `${TICKET_STATUS[f].label} (${tickets.filter((t) => t.status === f).length})`}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Headset} title="Nenhum chamado" text="Abra um chamado quando o cliente solicitar um serviço." testId="tickets-empty-state" />
        ) : (
          <Table data-testid="tickets-table">
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente / assunto</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Agendado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} data-testid={`ticket-row-${t.number}`}>
                  <TableCell className="font-mono text-sky-300">#{t.number}</TableCell>
                  <TableCell>
                    <p className="font-medium">{t.client_name}</p>
                    <p className="max-w-[260px] truncate text-xs text-muted-foreground">{t.title}</p>
                  </TableCell>
                  <TableCell className={cn("text-sm font-semibold", PRIORITY[t.priority].cls)}>{PRIORITY[t.priority].label}</TableCell>
                  <TableCell className="text-sm">{dateBR(t.scheduled_date)}</TableCell>
                  <TableCell><TicketStatusBadge status={t.status} testId={`ticket-status-${t.number}`} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {t.status === "aberto" && (
                        <Button size="sm" onClick={() => setQuoteFor(t)} data-testid={`ticket-create-quote-${t.number}`}>
                          <FilePlus2 className="size-3.5" /> Gerar orçamento
                        </Button>
                      )}
                      {t.order_id && (
                        <Link to="/admin/ordens" className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-white/5" data-testid={`ticket-view-order-${t.number}`}>
                          <Wrench className="size-3.5" /> OS
                        </Link>
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEdit({ open: true, ticket: t })} data-testid={`ticket-edit-${t.number}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {t.status === "aberto" && (
                        <Button size="icon-sm" variant="ghost" aria-label="Cancelar chamado" onClick={() => status.mutate({ id: t.id, s: "cancelado" })} data-testid={`ticket-cancel-${t.number}`}>
                          <Ban className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label="Excluir" className="hover:text-red-400" onClick={() => window.confirm("Excluir chamado?") && del.mutate(t.id)} data-testid={`ticket-delete-${t.number}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <TicketDialog open={edit.open} ticket={edit.ticket} onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))} />
      <QuoteFormDialog
        open={!!quoteFor}
        ticket={quoteFor}
        onOpenChange={(o) => !o && setQuoteFor(null)}
        onCreated={(q) => {
          qc.invalidateQueries({ queryKey: ["tickets"] });
          setShare(q);
        }}
      />
      <ShareQuoteDialog quote={share} onClose={() => setShare(null)} />
    </div>
  );
}

export function DayRoutePage() {
  const { data: today } = useToday();
  const { data: tickets = [] } = useTickets();
  const { data: orders = [] } = useOrders();
  const { data: techs = [] } = useTechs();
  const day = today?.today ?? "";

  const groups = useMemo(() => {
    const active = orders.filter((o) => o.status !== "concluida" || (o.finished_at ?? "").slice(0, 10) === day);
    const list = techs.map((t) => ({ id: t.id, name: t.name, orders: active.filter((o) => o.technician_id === t.id) }));
    const unassigned = active.filter((o) => !o.technician_id);
    return { list, unassigned };
  }, [orders, techs, day]);
  const scheduled = tickets.filter((t) => t.scheduled_date === day && t.status !== "cancelado");

  return (
    <div>
      <PageHeader eyebrow="Chamados" title="Roteiro do dia" description={day ? `Agenda de ${dateBR(day)} — chamados agendados e OS de cada técnico.` : "Carregando…"} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {groups.list.map((g) => (
            <section key={g.id} className="rounded-xl border border-border bg-card p-4" data-testid={`route-tech-${g.id}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-sky-500/15 text-sky-300"><UserIcon className="size-4" /></span>
                <p className="font-heading font-bold">{g.name}</p>
                <span className="ml-auto text-xs text-muted-foreground">{g.orders.length} OS</span>
              </div>
              {g.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem OS para hoje.</p>
              ) : (
                <ol className="space-y-2">
                  {g.orders.map((o, i) => (
                    <li key={o.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3" data-testid={`route-order-${o.number}`}>
                      <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">OS #{o.number} · {o.client_name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3" /> {o.client_address || "—"}</p>
                      </div>
                      <OrderStatusBadge status={o.status} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
          {groups.unassigned.length > 0 && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="route-unassigned">
              <p className="mb-2 font-semibold text-amber-300">OS sem técnico ({groups.unassigned.length})</p>
              {groups.unassigned.map((o) => (
                <p key={o.id} className="text-sm">#{o.number} · {o.client_name} — <Link className="text-sky-300 underline" to="/admin/ordens">atribuir</Link></p>
              ))}
            </section>
          )}
        </div>
        <aside className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 font-heading font-bold"><CalendarClock className="size-4 text-sky-400" /> Agendados hoje</p>
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="route-no-scheduled">Nenhum chamado agendado para hoje.</p>
          ) : (
            <ul className="space-y-2">
              {scheduled.map((t) => (
                <li key={t.id} className="rounded-lg border border-white/5 p-3" data-testid={`route-ticket-${t.number}`}>
                  <p className="text-sm font-semibold">#{t.number} · {t.client_name}</p>
                  <p className="text-xs text-muted-foreground">{t.title}</p>
                  <div className="mt-2"><TicketStatusBadge status={t.status} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-muted-foreground">Atualizado {dateTimeBR(new Date().toISOString())}</p>
        </aside>
      </div>
    </div>
  );
}
