import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LogOut, MessageCircle, QrCode, RefreshCw, Send, ShieldAlert, Smartphone, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AdminLayout";
import { CompanyFields } from "@/pages/admin/Company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { WhatsAppStatus } from "@/lib/types";

const LABEL: Record<WhatsAppStatus["status"], string> = {
  offline: "Serviço indisponível",
  disconnected: "Desconectado",
  connecting: "Conectando…",
  qr: "Aguardando leitura do QR Code",
  connected: "Conectado",
};

export function WhatsAppPage() {
  const qc = useQueryClient();
  const { data: wa } = useQuery({
    queryKey: ["whatsapp"],
    queryFn: () => apiGet<WhatsAppStatus>("/whatsapp/status"),
    refetchInterval: (q) => (q.state.data?.status === "qr" || q.state.data?.status === "connecting" ? 2500 : 10000),
  });
  const refresh = (s: WhatsAppStatus) => qc.setQueryData(["whatsapp"], s);
  const connect = useMutation({ mutationFn: () => apiPost<WhatsAppStatus>("/whatsapp/connect"), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const logout = useMutation({
    mutationFn: () => apiPost<WhatsAppStatus>("/whatsapp/logout"),
    onSuccess: (s) => {
      refresh(s);
      toast.success("WhatsApp desconectado");
    },
  });
  const [test, setTest] = useState({ phone: "", text: "Teste de mensagem do sistema Techline ✅" });
  const send = useMutation({
    mutationFn: () => apiPost("/whatsapp/send", test),
    onSuccess: () => toast.success("Mensagem enviada!"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const status = wa?.status ?? "connecting";
  const connected = status === "connected";

  return (
    <div>
      <PageHeader eyebrow="Integrações" title="WhatsApp" description="Conecte o seu WhatsApp lendo o QR Code — o sistema envia o link do orçamento, o aviso de rastreio ao cliente e alertas para você, pelo seu número." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-border bg-card p-6" data-testid="whatsapp-connection-card">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-full ${connected ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-muted-foreground"}`}>
              {connected ? <CheckCircle2 className="size-5" /> : status === "offline" ? <WifiOff className="size-5" /> : <MessageCircle className="size-5" />}
            </span>
            <div>
              <p className="font-heading text-lg font-bold" data-testid="whatsapp-status">{LABEL[status]}</p>
              {connected && wa?.me && <p className="text-sm text-muted-foreground" data-testid="whatsapp-me">{wa.me.name} · +{(wa.me.id ?? "").split(":")[0].split("@")[0]}</p>}
              {wa?.error && !connected && <p className="text-xs text-red-300" data-testid="whatsapp-error">{wa.error}</p>}
            </div>
            <div className="ml-auto flex gap-2">
              {connected ? (
                <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending} data-testid="whatsapp-logout-button"><LogOut className="size-4" /> Desconectar</Button>
              ) : (
                <Button onClick={() => connect.mutate()} disabled={connect.isPending || status === "qr" || status === "connecting"} data-testid="whatsapp-connect-button">
                  <QrCode className="size-4" /> {status === "qr" ? "QR Code gerado" : "Gerar QR Code"}
                </Button>
              )}
            </div>
          </div>

          {status === "qr" && wa?.qr && (
            <div className="mt-6 grid items-center gap-6 sm:grid-cols-[300px_1fr]">
              <div className="rounded-2xl bg-white p-3 shadow-[0_0_60px_-15px_rgb(16_185_129/0.6)]">
                <img src={wa.qr} alt="QR Code do WhatsApp" className="w-full" data-testid="whatsapp-qr-image" />
              </div>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
                <li>Abra o <b>WhatsApp</b> no celular da empresa</li>
                <li>Toque em <b>Mais opções (⋮)</b> ou <b>Configurações</b></li>
                <li>Toque em <b>Dispositivos conectados</b> → <b>Conectar dispositivo</b></li>
                <li>Aponte a câmera para este QR Code</li>
                <li className="list-none pt-2 text-xs text-muted-foreground"><RefreshCw className="mr-1 inline size-3" /> O código renova sozinho a cada ~20 s.</li>
              </ol>
            </div>
          )}
          {status === "connecting" && <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" data-testid="whatsapp-connecting" />}
          {connected && (
            <div className="mt-6 space-y-3 border-t border-border pt-5" data-testid="whatsapp-test-form">
              <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-sky-400" /> Enviar mensagem de teste</p>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-phone">Número</Label>
                  <Input id="wa-phone" placeholder="(11) 99999-0000" value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} data-testid="whatsapp-test-phone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-text">Mensagem</Label>
                  <Textarea id="wa-text" rows={2} value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} data-testid="whatsapp-test-text" />
                </div>
              </div>
              <Button onClick={() => send.mutate()} disabled={send.isPending || test.phone.replace(/\D/g, "").length < 10} data-testid="whatsapp-test-send"><Send className="size-4" /> Enviar</Button>
            </div>
          )}
          <p className="mt-6 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
            <ShieldAlert className="size-4 shrink-0" /> Conexão via WhatsApp Web (não oficial). Evite disparos em massa para não ter o número bloqueado. Se o celular ficar muito tempo sem internet, pode ser necessário ler o QR novamente.
          </p>
        </section>

        <div className="space-y-4">
          <CompanyFields
            testPrefix="wa-settings"
            fields={[
              { key: "owner_phone", label: "Seu WhatsApp (recebe alertas)", placeholder: "(11) 99999-0000", wide: true },
              { key: "wa_notify_owner", label: "Me avisar quando o cliente aprovar/recusar", type: "checkbox", wide: true },
              { key: "wa_send_tracking", label: "Avisar o cliente: técnico a caminho (link ao vivo), chegou ao local e OS concluída", type: "checkbox", wide: true },
              { key: "wa_notify_technician", label: "Avisar o técnico quando receber uma nova OS", type: "checkbox", wide: true },
            ]}
          />
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Mensagens automáticas</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Orçamento: botão “Enviar agora pelo meu WhatsApp” com o link de aprovar/recusar.</li>
              <li>OS iniciada: o cliente recebe o link para acompanhar o técnico ao vivo.</li>
              <li>Técnico chegou: o cliente é avisado que ele está no local.</li>
              <li>OS finalizada: o cliente recebe a OS assinada (comprovante com fotos).</li>
              <li>Aprovação/recusa: alerta para o seu número.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
