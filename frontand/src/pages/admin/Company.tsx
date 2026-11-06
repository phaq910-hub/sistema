import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ImagePlus, QrCode, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AdminLayout";
import { FieldInput, type FieldDef } from "@/components/ResourcePage";
import { Button } from "@/components/ui/button";
import { apiGet, apiPut } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Company, ServiceOrder, User } from "@/lib/types";

export function useCompany() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["company"], queryFn: () => apiGet<Company>("/company") });
  const save = useMutation({
    mutationFn: (c: Company) => apiPut<Company>("/company", c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
      qc.invalidateQueries({ queryKey: ["public-company"] });
      toast.success("Configurações salvas");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return { company: query.data, save };
}

/** Edits a subset of the Company document; saving merges into the full record. */
export function CompanyFields({ fields, testPrefix, children }: { fields: FieldDef[]; testPrefix: string; children?: (draft: Company, set: (p: Partial<Company>) => void) => React.ReactNode }) {
  const { company, save } = useCompany();
  const [draft, setDraft] = useState<Company | null>(null);
  const value = draft ?? company;
  if (!value) return <div className="h-48 animate-pulse rounded-xl bg-white/5" />;
  const set = (p: Partial<Company>) => setDraft({ ...value, ...p });
  const raw = value as unknown as Record<string, string | boolean>;
  return (
    <form
      className="space-y-5 rounded-xl border border-border bg-card p-6"
      data-testid={`${testPrefix}-form`}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(value, { onSuccess: () => setDraft(null) });
      }}
    >
      {children?.(value, set)}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={raw[f.key] ?? ""} testPrefix={testPrefix} onChange={(v) => set({ [f.key]: v } as Partial<Company>)} />
        ))}
      </div>
      <Button type="submit" disabled={save.isPending || !draft} data-testid={`${testPrefix}-save-button`}>
        <Save className="size-4" /> {save.isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 400 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function CompanyPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Minha empresa" title="Dados da empresa" description="Aparecem no orçamento, no rastreio e no comprovante que o cliente recebe." />
      <CompanyFields
        testPrefix="company"
        fields={[
          { key: "name", label: "Nome da empresa", required: true },
          { key: "tagline", label: "Slogan / ramo" },
          { key: "document", label: "CNPJ" },
          { key: "phone", label: "Telefone comercial" },
          { key: "email", label: "E-mail", type: "email" },
          { key: "address", label: "Endereço", wide: true },
        ]}
      >
        {(c, set) => (
          <div className="flex items-center gap-4">
            <span className="grid size-20 place-items-center overflow-hidden rounded-xl border border-border bg-white/5">
              {c.logo ? <img src={c.logo} alt="Logo" className="size-full object-contain" data-testid="company-logo-preview" /> : <Building2 className="size-8 text-muted-foreground" />}
            </span>
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium transition-colors duration-150 hover:bg-white/5">
                <ImagePlus className="size-4" /> Enviar logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="company-logo-input"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) set({ logo: await readImage(f) });
                  }}
                />
              </label>
              {c.logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ logo: null })} data-testid="company-logo-remove"><Trash2 className="size-4" /> Remover</Button>
              )}
            </div>
          </div>
        )}
      </CompanyFields>
    </div>
  );
}

export function PixPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Minha empresa" title="Recebimento (PIX)" description="Quando o cliente aprovar o orçamento, a chave PIX aparece para ele pagar e copiar com um toque." />
      <CompanyFields
        testPrefix="pix"
        fields={[
          { key: "pix_key_type", label: "Tipo de chave", type: "select", options: ["", "CNPJ", "CPF", "E-mail", "Telefone", "Aleatória"].map((v) => ({ value: v, label: v || "Selecione…" })) },
          { key: "pix_key", label: "Chave PIX" },
          { key: "pix_holder", label: "Nome do favorecido", wide: true },
        ]}
      >
        {(c) => (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm" data-testid="pix-preview">
            <QrCode className="size-6 text-emerald-400" />
            {c.pix_key ? <span>Cliente verá: <b>{c.pix_key_type} {c.pix_key}</b> — {c.pix_holder || c.name}</span> : <span className="text-muted-foreground">Nenhuma chave cadastrada ainda.</span>}
          </div>
        )}
      </CompanyFields>
    </div>
  );
}

export function PlanPage() {
  const { data: techs = [] } = useQuery({ queryKey: ["technicians"], queryFn: () => apiGet<User[]>("/technicians") });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => apiGet<ServiceOrder[]>("/orders") });
  const features = ["Orçamentos ilimitados com link de aprovação", "OS com GPS ao vivo e previsão de chegada", "Assinatura digital e comprovante", "Fotos antes/depois", "WhatsApp integrado", "Financeiro, estoque e catálogo"];
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Minha empresa" title="Plano e pagamento" />
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-transparent p-6" data-testid="plan-card">
        <Sparkles className="absolute right-6 top-6 size-10 text-sky-400/30" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Plano atual</p>
        <p className="mt-1 font-heading text-3xl font-extrabold" data-testid="plan-name">Profissional</p>
        <p className="mt-1 text-sm text-emerald-400" data-testid="plan-status">● Ativo — sistema próprio da {`Techline Consultoria`}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {features.map((f) => <p key={f} className="flex items-center gap-2 text-sm"><Check className="size-4 text-emerald-400" /> {f}</p>)}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
          <p>Técnicos ativos: <b className="font-mono" data-testid="plan-techs">{techs.length}</b></p>
          <p>OS registradas: <b className="font-mono" data-testid="plan-orders">{orders.length}</b></p>
        </div>
      </div>
    </div>
  );
}
