import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigation, Play, Flag, MapPin, Satellite, CheckCircle2, ExternalLink, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, RequireRole } from "@/components/AppHeader";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { dateTimeBR, errorMessage, timeBR } from "@/lib/format";
import type { FinishInput, ServiceOrder, User } from "@/lib/types";

function FinishDialog({ order, open, onOpenChange, onDone }: { order: ServiceOrder; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [signer, setSigner] = useState(order.client_name);
  const [notes, setNotes] = useState("");
  const [signed, setSigned] = useState(false);
  const finish = useMutation({
    mutationFn: (body: FinishInput) => apiPost<ServiceOrder>(`/orders/${order.id}/finish`, body),
    onSuccess: (o) => {
      onDone();
      onOpenChange(false);
      toast.success("OS finalizada com assinatura!", {
        action: { label: "Comprovante", onClick: () => window.open(`/recibo/${o.id}`, "_blank") },
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const signature = pad.current?.toDataUrl();
    if (!signer.trim()) return toast.error("Informe o nome de quem está assinando");
    if (!signature) return toast.error("Peça ao cliente para assinar no quadro");
    finish.mutate({ notes: notes.trim(), signer_name: signer.trim(), signature });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar OS #{order.number}</DialogTitle>
          <DialogDescription>Entregue o celular ao cliente para confirmar o serviço com a assinatura.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="finish-notes">Observações do atendimento</Label>
          <Textarea id="finish-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="O que foi feito, peças trocadas…" data-testid="finish-notes-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finish-signer">Nome de quem assina</Label>
          <Input id="finish-signer" value={signer} onChange={(e) => setSigner(e.target.value)} data-testid="finish-signer-input" />
        </div>
        <SignaturePad ref={pad} onChange={(empty) => setSigned(!empty)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="finish-cancel-button">Voltar</Button>
          <Button className="bg-green-600 text-white hover:bg-green-500" disabled={finish.isPending || !signed} onClick={submit} data-testid="finish-confirm-button">
            <CheckCircle2 className="size-4" /> {finish.isPending ? "Salvando…" : "Confirmar e finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type GpsState = { status: "off" | "waiting" | "on" | "error"; message?: string; lastSent?: string };

/** Streams the browser's GPS to the backend while an OS is in progress. */
function useGpsStream(orderId: string | null): GpsState {
  const [state, setState] = useState<GpsState>({ status: "off" });
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!orderId) {
      setState({ status: "off" });
      return;
    }
    if (!("geolocation" in navigator)) {
      setState({ status: "error", message: "Este dispositivo não suporta GPS" });
      return;
    }
    setState({ status: "waiting" });
    lastSentAt.current = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentAt.current < 4000) return; // throttle to one update / 4s
        lastSentAt.current = now;
        apiPost(`/orders/${orderId}/location`, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
          .then(() => setState({ status: "on", lastSent: new Date().toISOString() }))
          .catch(() => setState((s) => ({ ...s, status: "error", message: "Falha ao enviar localização" })));
      },
      (err) => setState({ status: "error", message: err.code === 1 ? "Permissão de localização negada — habilite o GPS no navegador" : "Não foi possível obter a localização" }),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [orderId]);

  return state;
}

function GpsPanel({ gps }: { gps: GpsState }) {
  const tone =
    gps.status === "on" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : gps.status === "error" ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-sky-500/30 bg-sky-500/10 text-sky-300";
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${tone}`} data-testid="gps-status" aria-live="polite">
      <Satellite className={`size-5 shrink-0 ${gps.status === "on" ? "animate-pulse" : ""}`} />
      <div>
        <p className="font-semibold">
          {gps.status === "on" ? "GPS transmitindo em tempo real" : gps.status === "waiting" ? "Obtendo sinal de GPS…" : gps.status === "error" ? "GPS com problema" : "GPS desligado"}
        </p>
        {gps.message && <p className="text-xs opacity-80">{gps.message}</p>}
        {gps.lastSent && gps.status === "on" && <p className="font-mono text-[11px] opacity-80">Último envio: {timeBR(gps.lastSent)}</p>}
      </div>
    </div>
  );
}

function OrderCard({ o, active, gps }: { o: ServiceOrder; active: boolean; gps: GpsState }) {
  const qc = useQueryClient();
  const [finishOpen, setFinishOpen] = useState(false);
  const done = () => qc.invalidateQueries({ queryKey: ["tech-orders"] });
  const action = useMutation({
    mutationFn: (kind: "start" | "arrive" | "begin") => apiPost<ServiceOrder>(`/orders/${o.id}/${kind}`),
    onSuccess: (_, kind) => {
      done();
      toast.success(kind === "start" ? "OS iniciada — cliente avisado no WhatsApp" : kind === "arrive" ? "Chegada registrada — cliente avisado" : "Atividade iniciada");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.client_address)}`;

  return (
    <article className={`space-y-4 rounded-2xl border bg-[#131C2E] p-5 transition-colors duration-200 ${active ? "border-sky-500/50 shadow-[0_0_40px_-12px_rgb(56_189_248/0.5)]" : "border-white/10"}`} data-testid={`tech-order-card-${o.number}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-sky-300">OS #{o.number}</p>
          <h3 className="font-heading text-xl font-bold">{o.client_name}</h3>
          <p className="text-xs text-slate-400">Recebida em {dateTimeBR(o.created_at)}</p>
        </div>
        <OrderStatusBadge status={o.status} testId={`tech-order-status-${o.number}`} />
      </div>
      <p className="text-sm text-slate-300">{o.description}</p>
      {o.client_address && (
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm transition-colors duration-150 hover:bg-white/5" data-testid={`tech-order-navigate-${o.number}`}>
          <MapPin className="size-4 shrink-0 text-sky-400" />
          <span className="flex-1">{o.client_address}</span>
          <Navigation className="size-4 text-slate-400" />
        </a>
      )}
      {active && <GpsPanel gps={gps} />}
      {o.status !== "atribuida" && (
        <div className="space-y-2 rounded-xl border border-white/10 p-3" data-testid={`tech-photos-${o.number}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fotos do serviço ({o.photo_count})</p>
          <PhotoGallery orderId={o.id} editable={o.status !== "concluida"} />
        </div>
      )}

      {o.status === "atribuida" && (
        <Button className="h-14 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-500" disabled={action.isPending} onClick={() => action.mutate("start")} data-testid={`tech-start-order-${o.number}`}>
          <Play className="size-5" /> Iniciar OS (ativar GPS)
        </Button>
      )}
      {o.status === "em_deslocamento" && (
        <Button className="h-14 w-full text-base font-semibold" variant="outline" disabled={action.isPending} onClick={() => action.mutate("arrive")} data-testid={`tech-arrive-order-${o.number}`}>
          <Flag className="size-5" /> Cheguei ao local
        </Button>
      )}
      {o.status === "no_local" && (
        <Button className="h-14 w-full bg-violet-600 text-base font-semibold text-white hover:bg-violet-500" disabled={action.isPending} onClick={() => action.mutate("begin")} data-testid={`tech-begin-activity-${o.number}`}>
          <Play className="size-5" /> Iniciar atividade
        </Button>
      )}
      {o.status === "em_atendimento" && (
        <Button className="h-14 w-full bg-green-600 text-base font-semibold text-white hover:bg-green-500" onClick={() => setFinishOpen(true)} data-testid={`tech-finish-order-${o.number}`}>
          <CheckCircle2 className="size-5" /> Finalizar OS (assinatura do cliente)
        </Button>
      )}
      {o.status === "concluida" && (
        <a href={`/recibo/${o.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", className: "w-full" })} data-testid={`tech-receipt-${o.number}`}>
          <FileCheck2 className="size-4" /> Ver comprovante
        </a>
      )}
      <FinishDialog order={o} open={finishOpen} onOpenChange={setFinishOpen} onDone={done} />
      <a href={`/rastreamento/${o.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-300" data-testid={`tech-order-client-view-${o.number}`}>
        <ExternalLink className="size-3.5" /> Ver como o cliente vê
      </a>
    </article>
  );
}

function TechHome({ user }: { user: User }) {
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["tech-orders"], queryFn: () => apiGet<ServiceOrder[]>("/tech/orders"), refetchInterval: 8000 });
  const activeOrder = orders.find((o) => o.status === "em_deslocamento" || o.status === "no_local" || o.status === "em_atendimento") ?? null;
  const gps = useGpsStream(activeOrder?.id ?? null);
  const pending = orders.filter((o) => o.status === "atribuida");
  const done = orders.filter((o) => o.status === "concluida");

  return (
    <div className="min-h-screen bg-[#0B0F17]">
      <AppHeader user={user} subtitle="App do técnico" />
      <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
        <div className="animate-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Olá, {user.name.split(" ")[0]}</p>
          <h1 className="font-heading text-3xl font-extrabold">Minhas ordens de serviço</h1>
        </div>
        {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-white/5" />}
        {activeOrder && (
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Em andamento</p>
            <OrderCard o={activeOrder} active gps={gps} />
          </section>
        )}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">A iniciar ({pending.length})</p>
          {pending.length === 0 && !isLoading && (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400" data-testid="tech-no-pending">Nenhuma OS aguardando. Novas OS aparecem aqui automaticamente.</p>
          )}
          {pending.map((o) => <OrderCard key={o.id} o={o} active={false} gps={gps} />)}
        </section>
        {done.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Concluídas</p>
            {done.slice(0, 10).map((o) => (
              <a key={o.id} href={`/recibo/${o.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm transition-colors duration-150 hover:border-sky-500/40" data-testid={`tech-done-${o.number}`}>
                <span><span className="font-mono text-sky-300">#{o.number}</span> · {o.client_name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">{dateTimeBR(o.finished_at)} <FileCheck2 className="size-3.5" /></span>
              </a>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default function Tech() {
  return <RequireRole role="tech">{(user) => <TechHome user={user} />}</RequireRole>;
}
