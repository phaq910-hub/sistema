import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { dateTimeBR, money } from "@/lib/format";
import type { Quote, ServiceOrder } from "@/lib/types";

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900" data-testid={testId}>{value || "—"}</p>
    </div>
  );
}

export default function Receipt() {
  const { id = "" } = useParams();
  const { data: o, isError, isLoading } = useQuery({ queryKey: ["public-order", id], queryFn: () => apiGet<ServiceOrder>(`/public/orders/${id}`) });
  const { data: q } = useQuery({
    queryKey: ["public-quote", o?.quote_id],
    queryFn: () => apiGet<Quote>(`/public/quotes/${o!.quote_id}`),
    enabled: !!o?.quote_id,
  });

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <p className="text-sm font-semibold text-slate-700">Comprovante de atendimento</p>
        <Button onClick={() => window.print()} data-testid="receipt-print-button" disabled={!o || o.status !== "concluida"}>
          <Printer className="size-4" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-slate-900 shadow-xl print:shadow-none sm:p-12" data-testid="receipt-document">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="[&_span]:!text-slate-900 [&_a>span:first-child]:!text-white">
            <BrandMark to={`/recibo/${id}`} />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Comprovante de serviço</p>
            <p className="font-heading text-2xl font-extrabold" data-testid="receipt-order-number">OS #{o?.number ?? "—"}</p>
            {o && <p className="text-xs text-slate-500">Orçamento #{o.quote_number}</p>}
          </div>
        </header>

        {isLoading && <div className="h-60 animate-pulse rounded bg-slate-100" />}
        {isError && <p className="text-sm text-slate-600" data-testid="receipt-not-found">Comprovante não encontrado.</p>}
        {o && o.status !== "concluida" && (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800" data-testid="receipt-not-ready">Este atendimento ainda não foi concluído. O comprovante fica disponível após a assinatura do cliente.</p>
        )}

        {o && o.status === "concluida" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <Row label="Cliente" value={o.client_name} testId="receipt-client-name" />
              <Row label="Endereço" value={o.client_address} />
              <Row label="Técnico responsável" value={o.technician_name ?? ""} testId="receipt-technician" />
              <Row label="Início / Conclusão" value={`${dateTimeBR(o.started_at)} → ${dateTimeBR(o.finished_at)}`} />
            </section>

            {q && (
              <table className="w-full text-sm" data-testid="receipt-items">
                <thead className="border-y border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr><th className="py-2">Serviço / produto</th><th className="py-2 text-right">Qtd</th><th className="py-2 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {q.items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2">{it.description}</td>
                      <td className="py-2 text-right font-mono">{it.quantity.toLocaleString("pt-BR")}</td>
                      <td className="py-2 text-right font-mono">{money(it.quantity * it.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {q.discount > 0 && <tr><td colSpan={2} className="pt-2 text-right text-slate-500">Desconto</td><td className="pt-2 text-right font-mono">− {money(q.discount)}</td></tr>}
                  <tr><td colSpan={2} className="pt-1 text-right font-semibold">Total</td><td className="pt-1 text-right font-mono text-lg font-semibold" data-testid="receipt-total">{money(q.total)}</td></tr>
                </tfoot>
              </table>
            )}

            {o.completion_notes && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Observações do técnico</p>
                <p className="mt-1 whitespace-pre-line text-sm" data-testid="receipt-notes">{o.completion_notes}</p>
              </section>
            )}

            {o.photo_count > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Registro fotográfico</p>
                <PhotoGallery orderId={o.id} light />
              </section>
            )}

            <section className="grid gap-6 border-t border-slate-200 pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Serviço concluído e aceito pelo cliente.</p>
                <p className="mt-1 text-xs text-slate-500">Assinado eletronicamente em {dateTimeBR(o.finished_at)}.</p>
              </div>
              <div className="w-full text-center sm:w-72">
                {o.signature && <img src={o.signature} alt="Assinatura do cliente" className="mx-auto h-28 object-contain" data-testid="receipt-signature" />}
                <div className="border-t border-slate-400 pt-1">
                  <p className="text-sm font-semibold" data-testid="receipt-signer-name">{o.signer_name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Assinatura do cliente</p>
                </div>
              </div>
            </section>
          </>
        )}
        <footer className="border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">Techline Consultoria · Documento gerado digitalmente</footer>
      </article>
    </div>
  );
}
