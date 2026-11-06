import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SignaturePadHandle {
  toDataUrl: () => string | null;
  clear: () => void;
}

/** Finger/mouse signature canvas. Returns a PNG data URL, or null when empty. */
export function SignaturePad({ ref, onChange }: { ref?: Ref<SignaturePadHandle>; onChange?: (empty: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0B0F17";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange?.(true);
  };

  useImperativeHandle(ref, () => ({
    clear,
    toDataUrl: () => {
      const c = canvas.current;
      if (!c || empty) return null;
      // flatten onto white so the PNG prints well
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(c, 0, 0);
      return out.toDataURL("image/png");
    },
  }));

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-400/60 bg-white">
        <canvas
          ref={canvas}
          data-testid="signature-canvas"
          className="block h-44 w-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const { x, y } = pos(e);
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 0.1, y + 0.1);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const { x, y } = pos(e);
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.lineTo(x, y);
            ctx.stroke();
            if (empty) {
              setEmpty(false);
              onChange?.(false);
            }
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        />
        {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">Assine aqui com o dedo</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-slate-300" />
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={clear} data-testid="signature-clear-button">
        <Eraser className="size-4" /> Limpar assinatura
      </Button>
    </div>
  );
}
