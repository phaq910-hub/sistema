import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin, Navigation, Headset, FileText, Wrench, Radar, AlertTriangle, ArrowRight } from "lucide-react";
import { EmptyState, Kpi, PageHeader, useAdminUser } from "@/components/AdminLayout";
import { OrderStatusBadge, QuoteStatusBadge, TicketStatusBadge } from "@/components/StatusBadge";
import { apiGet } from "@/lib/api";
import { dateTimeBR, money, monthKey, timeBR } from "@/lib/format";
import type { FinanceEntry, Product, Review, TeamMember } from "@/lib/types";
import { useOrders, useQuotes } from "@/pages/admin/Orders";
import { useTickets, useToday } from "@/pages/admin/Tickets";
import { cn } from "@/lib/utils";

const TeamMapView = lazy(() => import("@/components/TeamMapView"));

function Stars({ n, size = "size-4" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn(size, i <= n ? "fill-current" : "opacity-30")} />)}
    </span>
  );
}

export function DashboardPage() {
  const user = useAdminUser();
  const { data: quotes = [] } = useQuotes();
  const { data: orders = [] } = useOrders();
  const { data: tickets = [] } = useTickets();
  const { data: today } = useToday();
  const { data: finance = [] } = useQuery({ queryKey: ["finance"], queryFn: () => apiGet<FinanceEntry[]>("/finance") });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => apiGet<Product[]>("/products") });
  const { data: reviews = [] } = useQuery({ queryKey: ["reviews"], queryFn: () => apiGet<Review[]>("/reviews") });

  const s = useMemo(() => {
    const m = today ? monthKey(today.today) : "";
    return {
      openTickets: tickets.filter((t) => t.status === "aberto").length,
      pending: quotes.filter((q) => q.status === "pendente" && !q.expired).length,
      noTech: orders.filter((o) => o.status === "aberta").length,
      live: orders.filter((o) => o.status === "em_deslocamento" || o.status === "no_local" || o.status === "em_atendimento").length,
      receivable: finance.filter((f) => f.kind === "receber" && !f.paid && monthKey(f.due_date) === m).reduce((a, f) => a + f.amount, 0),
      lowStock: products.filter((p) => p.quantity <= p.min_quantity).length,
      rating: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0,
    };
  }, [quotes, orders, tickets, finance, products, reviews, today]);

  const shortcuts = [
    { to: "/admin/chamados", label: "Abrir chamado", icon: Headset },
    { to: "/admin/orcamentos", label: "Novo orçamento", icon: FileText },
    { to: "/admin/ordens", label: "Atribuir técnicos", icon: Wrench },
    { to: "/admin/mapa", label: "Ver equipe no mapa", icon: Radar },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Visão geral" title={`Olá, ${user.name.split(" ")[0]}`} description="Resumo da operação da Techline em tempo real." />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Chamados abertos" value={s.openTickets} hint="aguardando orçamento" accent="bg-amber-400" testId="kpi-open-tickets" />
        <Kpi label="Orçamentos pendentes" value={s.pending} hint="aguardando o cliente" accent="bg-sky-400" testId="kpi-pending" />
        <Kpi label="OS sem técnico" value={s.noTech} hint="selecione o técnico" accent="bg-red-400" testId="kpi-open-orders" />
        <Kpi label="Em campo agora" value={s.live} hint="técnicos com GPS ativo" accent="bg-emerald-400" testId="kpi-live" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((x) => (
          <Link key={x.to} to={x.to} className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-semibold transition-colors duration-150 hover:border-sky-500/40" data-testid={`shortcut-${x.to.split("/").pop()}`}>
            <x.icon className="size-4 text-sky-400" /> {x.label}
            <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <p className="border-b border-border px-5 py-3 font-heading font-bold">Últimas ordens de serviço</p>
          {orders.length === 0 ? (
            <EmptyState icon={Wrench} title="Sem OS ainda" text="Elas surgem quando o cliente aprova um orçamento." testId="dashboard-orders-empty" />
          ) : (
            <ul className="divide-y divide-border">
              {orders.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3 text-sm" data-testid={`dashboard-order-${o.number}`}>
                  <span className="font-mono text-sky-300">#{o.number}</span>
                  <span className="min-w-0 flex-1 truncate">{o.client_name} <span className="text-muted-foreground">· {o.technician_name ?? "sem técnico"}</span></span>
                  <OrderStatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Kpi label="A receber (mês)" value={money(s.receivable)} accent="bg-emerald-400" testId="kpi-receivable" />
            <Kpi label="Avaliação média" value={s.rating ? s.rating.toFixed(1) : "—"} hint={`${reviews.length} avaliação(ões)`} accent="bg-amber-400" testId="kpi-rating" />
          </div>
          {s.lowStock > 0 && (
            <Link to="/admin/estoque" className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" data-testid="dashboard-low-stock">
              <AlertTriangle className="size-4" /> {s.lowStock} produto(s) com estoque baixo
            </Link>
          )}
          <section className="rounded-xl border border-border bg-card">
            <p className="border-b border-border px-5 py-3 font-heading font-bold">Atividade recente</p>
            <ul className="divide-y divide-border text-sm">
              {quotes.slice(0, 3).map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2 px-5 py-2.5"><span>Orç. #{q.number} · {q.client_name}</span><QuoteStatusBadge status={q.status} expired={q.expired} /></li>
              ))}
              {tickets.slice(0, 3).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-5 py-2.5"><span>Chamado #{t.number} · {t.client_name}</span><TicketStatusBadge status={t.status} /></li>
              ))}
              {quotes.length + tickets.length === 0 && <li className="px-5 py-4 text-muted-foreground">Nada por aqui ainda.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function TeamMapPage() {
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: () => apiGet<TeamMember[]>("/team/locations"), refetchInterval: 5000 });
  const [sel, setSel] = useState<TeamMember | null>(null);
  return (
    <div>
      <PageHeader eyebrow="Equipe" title="Mapa da equipe" description="Última posição de cada técnico. Técnicos com OS em andamento piscam em azul e atualizam a cada poucos segundos." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[560px] overflow-hidden rounded-xl border border-border">
          <Suspense fallback={<div className="bg-grid size-full" />}>
            <TeamMapView members={team} onSelect={setSel} />
          </Suspense>
          {!team.some((m) => m.last_location) && (
            <div className="absolute inset-x-4 bottom-4 z-[500] rounded-xl border border-white/10 bg-[#0B0F17]/85 p-4 text-sm text-slate-300 backdrop-blur-xl" data-testid="team-map-empty">
              <MapPin className="mr-2 inline size-4 text-sky-400" /> As posições aparecem quando os técnicos iniciarem uma OS no celular.
            </div>
          )}
        </div>
        <ul className="space-y-2" data-testid="team-list">
          {team.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSel(m)}
                className={cn("w-full rounded-xl border bg-card p-4 text-left transition-colors duration-150", sel?.id === m.id ? "border-sky-500/50" : "border-border hover:border-white/20")}
                data-testid={`team-member-${m.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{m.name}</p>
                  {m.active_order_status ? <OrderStatusBadge status={m.active_order_status} /> : <span className="text-xs text-muted-foreground">Livre</span>}
                </div>
                {m.active_order_number && <p className="mt-1 text-xs text-muted-foreground">OS #{m.active_order_number} · {m.active_client_name}</p>}
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{m.last_location ? `Visto às ${timeBR(m.last_location.updated_at)} (${dateTimeBR(m.last_location.updated_at).split(" ")[0]})` : "Sem localização ainda"}</p>
                {sel?.id === m.id && m.active_order_id && (
                  <a href={`/rastreamento/${m.active_order_id}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 underline" data-testid={`team-member-track-${m.id}`}>
                    <Navigation className="size-3" /> Abrir rastreio da OS
                  </a>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ReviewsPage() {
  const { data: reviews = [] } = useQuery({ queryKey: ["reviews"], queryFn: () => apiGet<Review[]>("/reviews") });
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  return (
    <div>
      <PageHeader eyebrow="Qualidade" title="Avaliações" description="Após concluir a OS, o cliente avalia o atendimento pela página de rastreio." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-mono text-5xl font-semibold" data-testid="reviews-average">{avg ? avg.toFixed(1) : "—"}</p>
          <div className="mt-2"><Stars n={Math.round(avg)} size="size-5" /></div>
          <p className="mt-1 text-sm text-muted-foreground">{reviews.length} avaliação(ões)</p>
          <div className="mt-5 space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = reviews.filter((r) => r.rating === n).length;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{n}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5"><span className="block h-full bg-amber-400" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} /></span>
                  <span className="w-5 text-right text-muted-foreground">{c}</span>
                </div>
              );
            })}
          </div>
        </aside>
        <section className="space-y-3">
          {reviews.length === 0 && (
            <div className="rounded-xl border border-border bg-card"><EmptyState icon={Star} title="Nenhuma avaliação ainda" text="Elas aparecem aqui assim que os clientes avaliarem." testId="reviews-empty-state" /></div>
          )}
          {reviews.map((r) => (
            <article key={r.id} className="rounded-xl border border-border bg-card p-5" data-testid={`review-${r.id}`}>
              <div className="flex flex-wrap items-center gap-3">
                <Stars n={r.rating} />
                <p className="font-semibold">{r.client_name}</p>
                <span className="text-xs text-muted-foreground">OS #{r.order_number} · {r.technician_name ?? "—"}</span>
                <span className="ml-auto text-xs text-muted-foreground">{dateTimeBR(r.created_at)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-slate-300">“{r.comment}”</p>}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

