import { useEffect, useState } from "react";
import { BellRing, BellOff, Share, Smartphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from "@/lib/push";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header button: turns phone push notifications on/off and explains installation. */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  const run = async (fn: () => Promise<PushState>, ok?: string) => {
    setBusy(true);
    try {
      const s = await fn();
      setState(s);
      if (s === "on" && ok) toast.success(ok);
      if (s === "denied") toast.error("Notificações bloqueadas nas configurações do celular");
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível ativar as notificações"));
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Notificações no celular"
        onClick={() => setOpen(true)}
        className={cn("relative", on && "border-emerald-500/50 text-emerald-300")}
        data-testid="push-toggle-button"
      >
        {on ? <BellRing className="size-4" /> : <Smartphone className="size-4" />}
        {!on && state !== null && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notificações no celular</DialogTitle>
            <DialogDescription>Receba um alerta quando o cliente aprovar/recusar um orçamento e quando o técnico concluir o serviço — mesmo com o app fechado.</DialogDescription>
          </DialogHeader>

          {state === "needs-install" && (
            <ol className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 text-sm" data-testid="push-ios-steps">
              <li className="font-semibold text-sky-200">No iPhone, instale o app primeiro:</li>
              <li>1. Abra este site no <b>Safari</b></li>
              <li className="flex items-center gap-1">2. Toque em <Share className="inline size-4" /> <b>Compartilhar</b></li>
              <li>3. Escolha <b>Adicionar à Tela de Início</b></li>
              <li>4. Abra o app <b>Techline</b> pelo ícone e toque neste botão de novo</li>
            </ol>
          )}
          {state === "unsupported" && <p className="text-sm text-amber-300" data-testid="push-unsupported">Este navegador não suporta notificações. No Android use o Chrome; no iPhone, o Safari (iOS 16.4+).</p>}
          {state === "denied" && <p className="text-sm text-red-300" data-testid="push-denied">As notificações foram bloqueadas. Libere em Configurações → Notificações → Techline (ou nas permissões do site no Chrome).</p>}
          {state === "off" && (
            <p className="text-sm text-muted-foreground" data-testid="push-off-hint">
              No Android, para usar como app: menu ⋮ do Chrome → <b>Instalar app</b> / <b>Adicionar à tela inicial</b>.
            </p>
          )}
          {on && <p className="flex items-center gap-2 text-sm text-emerald-300" data-testid="push-on-status"><BellRing className="size-4" /> Ativado neste celular.</p>}

          <DialogFooter className="gap-2">
            {on ? (
              <>
                <Button variant="ghost" disabled={busy} onClick={() => run(disablePush)} data-testid="push-disable-button"><BellOff className="size-4" /> Desativar</Button>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    try {
                      const r = await sendTestPush();
                      toast.success(`Teste enviado para ${r.devices} aparelho(s)`);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                  data-testid="push-test-button"
                >
                  <Send className="size-4" /> Enviar teste
                </Button>
              </>
            ) : (
              <Button disabled={busy || state === "needs-install" || state === "unsupported"} onClick={() => run(enablePush, "Notificações ativadas neste celular")} data-testid="push-enable-button">
                <BellRing className="size-4" /> {busy ? "Ativando…" : "Ativar notificações"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
