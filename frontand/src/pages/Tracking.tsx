import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, FileCheck2, Phone, Radio, User as UserIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ReviewBox, usePublicCompany } from "@/components/PublicExtras";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { apiGet } from "@/lib/api";
import { dateTimeBR, timeBR } from "@/lib/format";
import type { OrderStatus, ServiceOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

const LiveMap = lazy(() => import("@/components/LiveMap"));

const STEPS: { status: OrderStatus[]; label: string }[] = [
  { status: ["aberta", "atribuida"], label: "Orçamento aprovado" },
  { status: ["em_deslocamento"], label: "Técnico a caminho" },
  { status: ["no_local"], label: "Técnico chegou" },
  { status: ["em_atendimento"], label: "Em atendimento" },
  { status: ["concluida"], label: "Concluído" },
];

export default function Tracking() {
  const { id = "" } = useParams();
  const { data: o, isError, isLoading } = useQuery({
    queryKey: ["public-order", id],
    queryFn: () => apiGet<ServiceOrder>(`/public/orders/${id}`),
    refetchInterval: (query) => (query.state.data?.status === "concluida" ? false : 4000),
  });

  const { data: company } = usePublicCompany();
  const currentStep = o ? STEPS.findIndex((s) => s.status.includes(o.status)) : 0;
  const live = !isError && (o?.status === "em_deslocamento" || o?.status === "no_local" || o?.status === "em_atendimento");

  return (
    <div className="flex min-h-screen flex-col bg-[#0B1329] lg:h-screen lg:flex-row">
      <section className="relative h-[55vh] lg:h-full lg:flex-1">
        <Suspense fallback={<div className="bg-grid size-full" />}>
          <LiveMap location={isError ? null : (o?.location ?? null)} trail={isError ? [] : (o?.trail ?? [])} destination={isError ? null : (o?.destination ?? null)} />
        </Suspense>
        {o?.status === "em_deslocamento" && o.eta_minutes != null && o.distance_km != null && (
          <div className="absolute bottom-4 left-4 z-[500] flex items-center gap-4 rounded-2xl border border-sky-500/30 bg-[#0B0F17]/90 px-5 py-3 shadow-[0_0_40px_-10px_rgb(56_189_248/0.6)] backdrop-blur-xl" data-testid="eta-chip">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Chegada prevista</p>
              <p className="font-mono text-2xl font-semibold text-sky-300" data-testid="eta-minutes">
                {o.eta_minutes < 1 ? "< 1 min" : `${Math.round(o.eta_minutes)} min`}
              </p>
              <p className="text-[11px] text-slate-400" data-testid="eta-clock">
                por volta das {new Date(Date.now() + o.eta_minutes * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <span className="h-12 w-px bg-white/10" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Distância</p>
              <p className="font-mono text-2xl font-semibold" data-testid="eta-distance">
                {o.distance_km < 1 ? `${Math.round(o.distance_km * 1000)} m` : `${o.distance_km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`}
              </p>
              <p className="text-[11px] text-slate-500">{o.eta_source === "rota" ? "pela rota de carro" : "estimativa"}</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between p-4">
          <div className="pointer-events-auto rounded-xl border border-white/10 bg-[#0B0F17]/80 px-3 py-2 backdrop-blur-xl"><BrandMark to={`/rastreamento/${id}`} /></div>
          {live && (
            <span className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#0B0F17]/85 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 backdrop-blur" data-testid="live-badge">
              <span className="relative flex size-2"><span className="absolute size-full animate-ping rounded-full bg-emerald-400" /><span className="relative size-2 rounded-full bg-emerald-400" /></span>
              Ao vivo
            </span>
          )}
        </div>
        {o && !o.location && o.status !== "concluida" && (
          <div className="absolute inset-x-4 bottom-4 z-[500] rounded-xl border border-white/10 bg-[#0B0F17]/85 p-4 text-sm text-slate-300 backdrop-blur-xl" data-testid="waiting-gps">
            <Radio className="mr-2 inline size-4 text-sky-400" />
            {o.status === "em_deslocamento" ? "Aguardando o primeiro sinal de GPS do técnico…" : "A localização aparecerá aqui quando o técnico iniciar o deslocamento."}
          </div>
        )}
      </section>

      <aside className="w-full space-y-6 overflow-y-auto border-l border-white/5 bg-[#0B0F17] p-6 lg:w-[400px]">
        {isLoading && <div className="h-40 animate-pulse rounded-xl bg-white/5" />}
        {isError && !o && (
          <div data-testid="tracking-not-found">
            <p className="font-heading text-lg font-bold">Atendimento não encontrado</p>
            <p className="text-sm text-slate-400">Verifique o link de rastreamento recebido.</p>
          </div>
        )}
        {o && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Rastreamento em tempo real</p>
              <h1 className="mt-1 font-heading text-2xl font-extrabold" data-testid="tracking-title">Ordem de serviço <span className="font-mono text-sky-300">#{o.number}</span></h1>
              <div className="mt-2"><OrderStatusBadge status={o.status} testId="tracking-status" /></div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#131C2E] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seu técnico</p>
              {o.technician_name ? (
                <div className="mt-2 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-sky-600/20 text-sky-300"><UserIcon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" data-testid="tracking-technician-name">{o.technician_name}</p>
                    <p className="text-xs text-slate-400">{company?.name ?? "Techline Consultoria"}</p>
                  </div>
                  {o.technician_phone && (
                    <a href={`tel:${o.technician_phone}`} data-testid="tracking-call-technician" aria-label="Ligar para o técnico" className="grid size-10 place-items-center rounded-full border border-white/10 text-sky-300 transition-colors duration-150 hover:bg-white/5">
                      <Phone className="size-4" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Estamos designando um técnico para o seu atendimento.</p>
              )}
              {o.location && (
                <p className="mt-3 font-mono text-[11px] text-slate-500" data-testid="tracking-last-update">
                  Última posição: {timeBR(o.location.updated_at)} · {o.location.lat.toFixed(5)}, {o.location.lng.toFixed(5)}
                </p>
              )}
            </div>

            <ol className="relative space-y-5 pl-8" data-testid="tracking-steps">
              <span className="absolute bottom-2 left-[11px] top-2 w-px bg-white/10" />
              {STEPS.map((s, i) => {
                const done = i < currentStep || o.status === "concluida";
                const active = i === currentStep && o.status !== "concluida";
                const ev = [...o.timeline].reverse().find((t) => s.status.includes(t.status));
                return (
                  <li key={s.label} className="relative" data-testid={`tracking-step-${i}`}>
                    <span className={cn("absolute -left-8 grid size-6 place-items-center rounded-full border-2", done ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-sky-400 bg-sky-400/20" : "border-white/15 bg-[#0B0F17]")}>
                      {done ? <Check className="size-3.5" /> : active ? <span className="size-2 animate-pulse rounded-full bg-sky-400" /> : null}
                    </span>
                    <p className={cn("text-sm font-semibold", !done && !active && "text-slate-500")}>{s.label}</p>
                    {ev && (done || active) && <p className="text-xs text-slate-400">{ev.label} · {dateTimeBR(ev.at)}</p>}
                  </li>
                );
              })}
            </ol>

            <div className="rounded-xl border border-white/10 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Serviço</p>
              <p className="mt-1 text-slate-300">{o.description}</p>
              {o.client_address && <p className="mt-2 text-xs text-slate-500">{o.client_address}</p>}
              {o.status === "concluida" && o.completion_notes && <p className="mt-3 border-t border-white/10 pt-3 text-slate-300" data-testid="tracking-completion-notes">{o.completion_notes}</p>}
            </div>
            {o.photo_count > 0 && <PhotoGallery orderId={o.id} />}
            {o.status === "concluida" && <ReviewBox orderId={o.id} />}
            {o.status === "concluida" && (
              <a href={`/recibo/${o.id}`} className={buttonVariants({ size: "lg", className: "w-full" })} data-testid="tracking-receipt-link">
                <FileCheck2 className="size-4" /> Ver comprovante assinado
              </a>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
