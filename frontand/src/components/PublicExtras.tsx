import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, QrCode, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, money } from "@/lib/format";
import type { PublicCompany, Review, ReviewCreate } from "@/lib/types";
import { cn } from "@/lib/utils";

export const usePublicCompany = () => useQuery({ queryKey: ["public-company"], queryFn: () => apiGet<PublicCompany>("/public/company"), staleTime: 300_000 });

/** Shown to the client after approving a quote, when the company configured a PIX key. */
export function PixCard({ amount }: { amount: number }) {
  const { data: c } = usePublicCompany();
  if (!c?.pix_key) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/30 bg-[#0F1A17] p-5" data-testid="pix-card">
      <QrCode className="size-8 text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Pagamento via PIX · {money(amount)}</p>
        <p className="break-all font-mono text-sm" data-testid="pix-key">{c.pix_key_type ? `${c.pix_key_type}: ` : ""}{c.pix_key}</p>
        <p className="text-xs text-slate-400">Favorecido: {c.pix_holder || c.name}</p>
      </div>
      <Button
        variant="outline"
        data-testid="pix-copy-button"
        onClick={() => {
          void navigator.clipboard?.writeText(c.pix_key);
          toast.success("Chave PIX copiada");
        }}
      >
        <Copy className="size-4" /> Copiar chave
      </Button>
    </div>
  );
}

export function ReviewBox({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const key = ["public-review", orderId];
  const { data: review, isLoading } = useQuery({ queryKey: key, queryFn: () => apiGet<Review | null>(`/public/orders/${orderId}/review`) });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const send = useMutation({
    mutationFn: () => apiPost<Review>(`/public/orders/${orderId}/review`, { rating, comment: comment.trim() } satisfies ReviewCreate),
    onSuccess: (r) => {
      qc.setQueryData(key, r);
      toast.success("Obrigado pela avaliação!");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return null;
  const shown = review?.rating ?? rating;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="review-box">
      <p className="text-sm font-semibold">{review ? "Sua avaliação" : "Como foi o atendimento?"}</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" disabled={!!review} onClick={() => setRating(n)} aria-label={`${n} estrelas`} data-testid={`review-star-${n}`} className="transition-transform duration-150 enabled:hover:scale-110">
            <Star className={cn("size-7 text-amber-400", n <= shown ? "fill-current" : "opacity-30")} />
          </button>
        ))}
      </div>
      {review ? (
        review.comment && <p className="mt-2 text-sm text-slate-300" data-testid="review-comment-display">“{review.comment}”</p>
      ) : (
        <>
          <Textarea className="mt-3" rows={2} placeholder="Deixe um comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} data-testid="review-comment-input" />
          <Button className="mt-2 w-full" disabled={!rating || send.isPending} onClick={() => send.mutate()} data-testid="review-submit-button">Enviar avaliação</Button>
        </>
      )}
    </div>
  );
}
