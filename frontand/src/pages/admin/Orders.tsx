import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, FileText, Wrench, Trash2, MapPin, Copy, FileCheck2, Images, Star, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/AdminLayout";
import { QuoteFormDialog, ShareQuoteDialog } from "@/components/QuoteForm";
import { PhotoGallery } from "@/components/PhotoGallery";
import { OrderStatusBadge, QuoteStatusBadge } from "@/components/StatusBadge";
import { nativeSelectCls } from "@/components/ResourcePage";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { dateBR, dateTimeBR, errorMessage, money, publicUrl } from "@/lib/format";
import type { Quote, ServiceOrder, User } from "@/lib/types";
import { cn } from "@/lib/utils";

export const useQuotes = () => useQuery({ queryKey: ["quotes"], queryFn: () => apiGet<Quote[]>("/quotes"), refetchInterval: 8000 });
export const useOrders = () => useQuery({ queryKey: ["orders"], queryFn: () => apiGet<ServiceOrder[]>("/orders"), refetchInterval: 6000 });
export const useTechs = () => useQuery({ queryKey: ["technicians"], queryFn: () => apiGet<User[]>("/technicians") });

export function QuotesPage() {
  const qc = useQueryClient();
  const { data: quotes = [] } = useQuotes();
  const [filter, setFilter] = useState<"todos" | "pendente" | "aprovado" | "recusado">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [share, setShare] = useState<Quote | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/quotes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento excluído");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = filter === "todos" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <div>
      <PageHeader
        eyebrow="Comercial"
        title="Orçamentos"
        description="Crie o orçamento e envie o link para o cliente aprovar ou recusar. Ao aprovar, a OS é gerada automaticamente."
        actions={<Button onClick={() => setFormOpen(true)} data-testid="new-quote-button"><Plus className="size-4" /> Novo orçamento</Button>}
      />
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          {(["todos", "pendente", "aprovado", "recusado"] as const).map((f) => (
            <button
              key={f}
              data-testid={`quotes-filter-${f}`}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150",
                filter === f ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "todos" ? "Todos" : f === "pendente" ? "Pendentes" : f === "aprovado" ? "Aprovados" : "Recusados"}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum orçamento aqui" text="Crie um orçamento e envie o link para o cliente." testId="quotes-empty-state" />
        ) : (
          <Table data-testid="quotes-table">
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id} data-testid={`quote-row-${q.number}`}>
                  <TableCell className="font-mono text-sky-300">#{q.number}</TableCell>
                  <TableCell>
                    <p className="font-medium">{q.client_name}</p>
                    <p className="text-xs text-muted-foreground">{q.client_phone || q.client_email || "—"}</p>
                  </TableCell>
                  <TableCell className="font-mono">{money(q.total)}</TableCell>
                  <TableCell className="text-sm">{dateBR(q.valid_until)}</TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={q.status} expired={q.expired} testId={`quote-status-${q.number}`} />
                    {q.sent_at && q.status === "pendente" && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400" data-testid={`quote-sent-${q.number}`}><CheckCheck className="size-3" /> Enviado {dateTimeBR(q.sent_at)}</p>
                    )}
                    {q.reject_reason && <p className="mt-1 max-w-[200px] truncate text-xs text-muted-foreground">“{q.reject_reason}”</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" data-testid={`quote-share-${q.number}`} onClick={() => setShare(q)}>
                        <Send className="size-3.5" /> Enviar
                      </Button>
                      {q.status === "pendente" && (
                        <Button size="icon-sm" variant="ghost" aria-label="Excluir" data-testid={`quote-delete-${q.number}`} onClick={() => window.confirm("Excluir orçamento?") && del.mutate(q.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <QuoteFormDialog open={formOpen} onOpenChange={setFormOpen} onCreated={setShare} />
      <ShareQuoteDialog quote={share} onClose={() => setShare(null)} />
    </div>
  );
}

function OrderDetailDialog({ order, onClose }: { order: ServiceOrder | null; onClose: () => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle>OS #{order.number} — {order.client_name}</DialogTitle>
              <DialogDescription>{order.client_address || order.description}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <OrderStatusBadge status={order.status} />
              {order.technician_name && <span className="text-muted-foreground">Técnico: {order.technician_name}</span>}
              {order.review_rating && <span className="flex items-center gap-1 text-amber-300"><Star className="size-4 fill-current" /> {order.review_rating}/5</span>}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fotos do serviço</p>
            <PhotoGallery orderId={order.id} />
            {order.photo_count === 0 && <p className="text-sm text-muted-foreground" data-testid="order-detail-no-photos">O técnico ainda não adicionou fotos.</p>}
            <ol className="space-y-2 border-t border-border pt-3 text-sm" data-testid="order-detail-timeline">
              {order.timeline.map((t) => (
                <li key={`${t.at}-${t.label}`} className="flex justify-between gap-3"><span>{t.label}</span><span className="text-xs text-muted-foreground">{dateTimeBR(t.at)}</span></li>
              ))}
            </ol>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function OrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useOrders();
  const { data: techs = [] } = useTechs();
  const [detail, setDetail] = useState<ServiceOrder | null>(null);
  const assign = useMutation({
    mutationFn: ({ id, technician_id }: { id: string; technician_id: string }) => apiPost<ServiceOrder>(`/orders/${id}/assign`, { technician_id }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`OS #${o.number} encaminhada para ${o.technician_name}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader eyebrow="Chamados" title="Ordens de Serviço" description="Selecione o técnico de cada OS aprovada. O cliente recebe o link de rastreio no WhatsApp quando o técnico iniciar." />
      <div className="rounded-xl border border-border bg-card">
        {orders.length === 0 ? (
          <EmptyState icon={Wrench} title="Nenhuma ordem de serviço" text="As OS são criadas automaticamente quando o cliente aprova um orçamento." testId="orders-empty-state" />
        ) : (
          <Table data-testid="orders-table">
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const locked = ["em_deslocamento", "no_local", "em_atendimento", "concluida"].includes(o.status);
                return (
                  <TableRow key={o.id} data-testid={`order-row-${o.number}`}>
                    <TableCell>
                      <p className="font-mono text-sky-300">#{o.number}</p>
                      <p className="text-xs text-muted-foreground">Orç. #{o.quote_number}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{o.client_name}</p>
                      <p className="max-w-[220px] truncate text-xs text-muted-foreground">{o.client_address || o.description}</p>
                    </TableCell>
                    <TableCell>
                      {locked ? (
                        <span className="text-sm">{o.technician_name}</span>
                      ) : (
                        <select
                          className={cn(nativeSelectCls, "h-8 w-[180px]", !o.technician_id && "border-amber-500/50")}
                          value={o.technician_id ?? ""}
                          onChange={(e) => e.target.value && assign.mutate({ id: o.id, technician_id: e.target.value })}
                          data-testid={`order-assign-select-${o.number}`}
                        >
                          <option value="">Selecionar técnico…</option>
                          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                    </TableCell>
                    <TableCell><OrderStatusBadge status={o.status} testId={`order-status-${o.number}`} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dateTimeBR(o.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(o)} data-testid={`order-detail-${o.number}`}>
                          <Images className="size-3.5" /> {o.photo_count}
                        </Button>
                        {o.status === "concluida" && (
                          <a href={`/recibo/${o.id}`} target="_blank" rel="noreferrer" data-testid={`order-receipt-${o.number}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                            <FileCheck2 className="size-3.5" /> Recibo
                          </a>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Copiar link de rastreio"
                          data-testid={`order-copy-tracking-${o.number}`}
                          onClick={() => {
                            void navigator.clipboard?.writeText(publicUrl(`/rastreamento/${o.id}`));
                            toast.success("Link de rastreio copiado");
                          }}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <a href={`/rastreamento/${o.id}`} target="_blank" rel="noreferrer" data-testid={`order-open-tracking-${o.number}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          <MapPin className="size-3.5" /> Mapa
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <OrderDetailDialog order={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
