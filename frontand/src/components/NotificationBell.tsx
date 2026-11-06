import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { dateTimeBR } from "@/lib/format";
import type { NotificationList } from "@/lib/types";
import { cn } from "@/lib/utils";

function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.32);
    });
  } catch {
    /* audio blocked until user interaction — ignore */
  }
}

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    refetchInterval: 5000,
  });
  const seen = useRef<string | null>(null);

  // Toast + chime when a new notification arrives (skip the first load).
  useEffect(() => {
    const latest = data?.items[0];
    if (!latest) return;
    if (seen.current !== null && seen.current !== latest.id && !latest.read) {
      toast(latest.title, { description: latest.message });
      chime();
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    }
    seen.current = latest.id;
  }, [data, qc]);

  const readAll = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        data-testid="notification-bell"
        aria-label="Notificações"
        className="relative grid size-10 place-items-center rounded-lg border border-border bg-card/60 transition-colors duration-200 hover:border-sky-500/50 hover:bg-secondary"
      >
        <Bell className={cn("size-[18px]", unread > 0 && "text-sky-400")} />
        {unread > 0 && (
          <span
            data-testid="notification-unread-count"
            className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white animate-in zoom-in"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-heading text-sm font-bold">Notificações</p>
          <Button
            size="xs"
            variant="ghost"
            data-testid="notification-read-all"
            disabled={unread === 0 || readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            <CheckCheck className="size-3.5" /> Marcar como lidas
          </Button>
        </div>
        <div className="max-h-[380px] overflow-y-auto" data-testid="notification-list">
          {!data?.items.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação ainda.</p>}
          {data?.items.map((n) => (
            <button
              key={n.id}
              data-testid={`notification-item-${n.id}`}
              onClick={() => n.link && navigate(n.link)}
              className={cn(
                "flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors duration-150 hover:bg-secondary/70",
                !n.read && "bg-sky-500/5",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  n.type === "quote_rejected" ? "bg-red-400" : n.type === "quote_approved" ? "bg-emerald-400" : "bg-sky-400",
                  n.read && "opacity-30",
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{n.title}</span>
                <span className="block text-xs text-muted-foreground">{n.message}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground/80">{dateTimeBR(n.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
