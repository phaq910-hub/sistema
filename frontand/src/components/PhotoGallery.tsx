import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { OrderPhoto, PhotoCreate } from "@/lib/types";

/** Downscale to max 1280px JPEG so photos stay small in the database. */
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = URL.createObjectURL(file);
  });
}

const KINDS = [
  { kind: "antes", label: "Antes do serviço" },
  { kind: "depois", label: "Depois do serviço" },
] as const;

export function PhotoGallery({ orderId, editable = false, light = false }: { orderId: string; editable?: boolean; light?: boolean }) {
  const qc = useQueryClient();
  const key = ["order-photos", orderId];
  const { data: photos = [] } = useQuery({ queryKey: key, queryFn: () => apiGet<OrderPhoto[]>(`/orders/${orderId}/photos`) });
  const [zoom, setZoom] = useState<OrderPhoto | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["tech-orders"] });
  };

  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: PhotoCreate["kind"]; file: File }) =>
      apiPost<OrderPhoto>(`/orders/${orderId}/photos`, { kind, image: await compress(file), caption: "" } satisfies PhotoCreate),
    onSuccess: () => {
      refresh();
      toast.success("Foto adicionada");
    },
    onError: (e) => toast.error(errorMessage(e, "Falha ao enviar a foto")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/orders/${orderId}/photos/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!editable && photos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3" data-testid={`photo-gallery-${orderId}`}>
      {KINDS.map(({ kind, label }) => {
        const list = photos.filter((p) => p.kind === kind);
        return (
          <div key={kind} className="space-y-2">
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${light ? "text-slate-600" : "text-slate-400"}`}>{label}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {list.map((p) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10">
                  <button type="button" className="size-full" onClick={() => setZoom(p)} data-testid={`photo-thumb-${p.id}`}>
                    <img src={p.image} alt={label} className="size-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  </button>
                  {editable && (
                    <button type="button" aria-label="Remover foto" className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-red-300" onClick={() => remove.mutate(p.id)} data-testid={`photo-delete-${p.id}`}>
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              {list.length === 0 && !editable && <p className="col-span-2 text-xs text-slate-500">Sem fotos</p>}
            </div>
            {editable && (
              <>
                <input
                  ref={(el) => {
                    inputs.current[kind] = el;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  data-testid={`photo-input-${kind}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate({ kind, file });
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="w-full" disabled={upload.isPending} onClick={() => inputs.current[kind]?.click()} data-testid={`photo-add-${kind}`}>
                  {list.length ? <ImageIcon className="size-4" /> : <Camera className="size-4" />} {upload.isPending ? "Enviando…" : `Foto ${kind}`}
                </Button>
              </>
            )}
          </div>
        );
      })}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto — {zoom?.kind === "antes" ? "antes" : "depois"} do serviço</DialogTitle>
            <DialogDescription>{zoom && new Date(zoom.created_at).toLocaleString("pt-BR")}</DialogDescription>
          </DialogHeader>
          {zoom && <img src={zoom.image} alt="Foto ampliada" className="max-h-[70vh] w-full rounded-lg object-contain" data-testid="photo-zoom-image" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
