import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, CalendarClock, Printer, MapPin } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { PixCard } from "@/components/PublicExtras";
import { QuoteStatusBadge } from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { dateBR, dateTimeBR, errorMessage, money } from "@/lib/format";
import type { Quote } from "@/lib/types";

export default function PublicQuote() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { data: q, isLoading, isError } = useQuery({ queryKey: ["public-quote", id], queryFn: () => apiGet<Quote>(`/public/quotes/${id}`), retry: 1 });

  const onDone = (updated: Quote) => qc.setQueryData(["public-quote", id], updated);
  const approve = useMutation({
    mutationFn: () => apiPost<Quote>(`/public/quotes/${id}/approve`),
    onSuccess: (u) => {
      onDone(u);
      toast.success("Orçamento aprovado! Obrigado.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => apiPost<Quote>(`/public/quotes/${id}/reject`, { reason }),
    onSuccess: (u) => {
      onDone(u);
      setRejectOpen(false);
      toast("Orçamento recusado", { description: "Sua resposta foi enviada." });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="no-print border-b border-[#334155] bg-[#0B0F17]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <BrandMark to={`/orcamento/${id}`} />
          <Button variant="ghost" size="sm" onClick={() => window.print()} data-testid="print-quote-button">
            <Printer className="size-4" /> Imprimir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {isLoading && <div className="h-96 animate-pulse rounded-2xl bg-white/5" data-testid="quote-loading" />}
        {(isError || (!isLoading && !q)) && (
          <div className="rounded-2xl border border-[#334155] p-10 text-center" data-testid="quote-not-found">
            <p className="font-heading text-xl font-bold">Orçamento não encontrado</p>
            <p className="mt-1 text-sm text-slate-400">Verifique o link recebido ou fale com a Techline Consultoria.</p>
          </div>
        )}
        {q && (
          <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Proposta comercial</p>
                <h1 className="mt-1 font-heading text-3xl font-extrabold sm:text-4xl" data-testid="public-quote-title">
                  Orçamento <span className="font-mono text-sky-300">#{q.number}</span>
                </h1>
                <p className="mt-1 text-sm text-slate-400">Emitido em {dateBR(q.created_at)}</p>
              </div>
              <QuoteStatusBadge status={q.status} expired={q.expired} testId="public-quote-status" />
            </div>

            {q.status === "pendente" && (
              <div className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${q.expired ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`} data-testid="quote-validity-banner">
                <CalendarClock className="size-5 shrink-0" />
                {q.expired ? `Este orçamento venceu em ${dateBR(q.valid_until)}. Solicite uma nova proposta.` : `Proposta válida até ${dateBR(q.valid_until)}.`}
              </div>
            )}

            <div className="grid gap-4 rounded-2xl border border-[#334155] bg-[#0B1220] p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</p>
                <p className="mt-1 font-semibold" data-testid="public-quote-client">{q.client_name}</p>
                {q.client_email && <p className="text-sm text-slate-400">{q.client_email}</p>}
                {q.client_phone && <p className="text-sm text-slate-400">{q.client_phone}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Local do atendimento</p>
                <p className="mt-1 text-sm text-slate-300">{q.client_address || "A combinar"}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#334155]">
              <table className="w-full text-sm" data-testid="public-quote-items">
                <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Descrição</th>
                    <th className="px-3 py-3 text-right font-semibold">Qtd</th>
                    <th className="hidden px-3 py-3 text-right font-semibold sm:table-cell">Unitário</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((it, i) => (
                    <tr key={i} className="border-t border-[#334155]/70">
                      <td className="px-5 py-3.5">{it.description}</td>
                      <td className="px-3 py-3.5 text-right font-mono">{it.quantity.toLocaleString("pt-BR")}</td>
                      <td className="hidden px-3 py-3.5 text-right font-mono text-slate-400 sm:table-cell">{money(it.unit_price)}</td>
                      <td className="px-5 py-3.5 text-right font-mono">{money(it.quantity * it.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1.5 border-t border-[#334155] bg-white/[0.02] px-5 py-4 text-sm">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-mono">{money(q.subtotal)}</span></div>
                {q.discount > 0 && (
                  <div className="flex justify-between text-emerald-400"><span>Desconto</span><span className="font-mono">− {money(q.discount)}</span></div>
                )}
                <div className="flex items-baseline justify-between pt-2">
                  <span className="font-heading text-base font-bold">Total</span>
                  <span className="font-mono text-3xl font-semibold text-sky-300" data-testid="public-quote-total">{money(q.total)}</span>
                </div>
              </div>
            </div>

            {q.notes && (
              <div className="rounded-2xl border border-[#334155] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observações</p>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{q.notes}</p>
              </div>
            )}

            <div className="no-print">
              {q.status === "pendente" && !q.expired && (
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]" aria-live="polite">
                  <Button
                    size="lg"
                    className="h-14 bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-500"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate()}
                    data-testid="approve-quote-btn"
                  >
                    <CheckCircle2 className="size-5" /> {approve.isPending ? "Aprovando…" : "Aprovar orçamento"}
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 border-red-500/40 text-base text-red-300 hover:bg-red-500/10" onClick={() => setRejectOpen(true)} data-testid="reject-quote-btn">
                    <XCircle className="size-5" /> Recusar
                  </Button>
                </div>
              )}
              {q.status === "aprovado" && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6" data-testid="quote-approved-panel">
                  <div>
                    <p className="flex items-center gap-2 font-heading text-lg font-bold text-emerald-300"><CheckCircle2 className="size-5" /> Orçamento aprovado</p>
                    <p className="text-sm text-slate-300">Aprovado em {dateTimeBR(q.responded_at)}. Uma ordem de serviço foi gerada — acompanhe o técnico ao vivo.</p>
                  </div>
                  {q.order_id && (
                    <Link to={`/rastreamento/${q.order_id}`} className={buttonVariants({ size: "lg" })} data-testid="track-order-link">
                      <MapPin className="size-4" /> Acompanhar atendimento
                    </Link>
                  )}
                </div>
              )}
              {q.status === "aprovado" && <PixCard amount={q.total} />}
              {q.status === "recusado" && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6" data-testid="quote-rejected-panel">
                  <p className="font-heading text-lg font-bold text-red-300">Orçamento recusado</p>
                  <p className="text-sm text-slate-300">Recebemos sua resposta em {dateTimeBR(q.responded_at)}. Obrigado pelo retorno.</p>
                </div>
              )}
            </div>
          </motion.article>
        )}
      </main>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar orçamento</DialogTitle>
            <DialogDescription>Se quiser, conte o motivo — isso nos ajuda a melhorar a proposta.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: valor acima do esperado" data-testid="reject-reason-input" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} data-testid="reject-cancel-button">Voltar</Button>
            <Button variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate()} data-testid="reject-confirm-button">Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
