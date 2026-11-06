import { cn } from "@/lib/utils";
import { ORDER_STATUS, QUOTE_STATUS, TICKET_STATUS } from "@/lib/format";
import type { OrderStatus, QuoteStatus, TicketStatus } from "@/lib/types";

export function TicketStatusBadge({ status, testId }: { status: TicketStatus; testId?: string }) {
  const s = TICKET_STATUS[status];
  return (
    <span data-testid={testId} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      {s.label}
    </span>
  );
}

export function QuoteStatusBadge({ status, expired, testId }: { status: QuoteStatus; expired?: boolean; testId?: string }) {
  const s = expired ? { label: "Vencido", cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" } : QUOTE_STATUS[status];
  return (
    <span data-testid={testId} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      {s.label}
    </span>
  );
}

export function OrderStatusBadge({ status, testId }: { status: OrderStatus; testId?: string }) {
  const s = ORDER_STATUS[status];
  const live = status === "em_deslocamento" || status === "no_local" || status === "em_atendimento";
  return (
    <span data-testid={testId} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      {live && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {s.label}
    </span>
  );
}
