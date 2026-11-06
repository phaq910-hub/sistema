import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeSelectCls } from "@/components/ResourcePage";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Client, ClientCreate } from "@/lib/types";

/** Select an existing client or quick-create one inline. */
export function ClientPicker({ value, onChange, testPrefix }: { value: string; onChange: (c: Client | null) => void; testPrefix: string }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => apiGet<Client[]>("/clients") });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", address: "" });
  const create = useMutation({
    mutationFn: () => apiPost<Client>("/clients", { ...draft, document: "", email: "", notes: "" } satisfies ClientCreate),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      onChange(c);
      setAdding(false);
      setDraft({ name: "", phone: "", address: "" });
      toast.success(`Cliente ${c.name} cadastrado`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          className={nativeSelectCls}
          value={value}
          onChange={(e) => onChange(clients.find((c) => c.id === e.target.value) ?? null)}
          data-testid={`${testPrefix}-client-select`}
        >
          <option value="">Selecione um cliente…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setAdding(!adding)} data-testid={`${testPrefix}-client-quick-add`}>
          <UserPlus className="size-4" /> Novo
        </Button>
      </div>
      {adding && (
        <div className="grid gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 sm:grid-cols-[1fr_1fr]">
          <Input placeholder="Nome *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid={`${testPrefix}-quick-client-name`} />
          <Input placeholder="WhatsApp" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} data-testid={`${testPrefix}-quick-client-phone`} />
          <Input className="sm:col-span-2" placeholder="Endereço" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} data-testid={`${testPrefix}-quick-client-address`} />
          <Button type="button" size="sm" className="sm:col-span-2" disabled={!draft.name.trim() || create.isPending} onClick={() => create.mutate()} data-testid={`${testPrefix}-quick-client-save`}>
            Cadastrar cliente
          </Button>
        </div>
      )}
    </div>
  );
}
