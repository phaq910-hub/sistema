import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "email" | "password" | "number" | "date" | "textarea" | "select" | "checkbox";
export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
  nullable?: boolean;
}
export interface ColumnDef<T> {
  label: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

type FormValues = Record<string, string | boolean>;

export const nativeSelectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>option]:bg-[#0F172A]";

function toValues(fields: FieldDef[], src: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = src[f.key];
    out[f.key] = f.type === "checkbox" ? Boolean(v) : v == null ? "" : String(v);
  }
  return out;
}

function fromValues(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.type === "checkbox") out[f.key] = Boolean(v);
    else if (f.type === "number") out[f.key] = Number(String(v).replace(",", ".")) || 0;
    else if (f.nullable && !String(v).trim()) out[f.key] = null;
    else out[f.key] = String(v).trim();
  }
  return out;
}

export function FieldInput({ f, value, onChange, testPrefix }: { f: FieldDef; value: string | boolean; onChange: (v: string | boolean) => void; testPrefix: string }) {
  const id = `${testPrefix}-${f.key}`;
  const testId = `${testPrefix}-${f.key.replace(/_/g, "-")}-input`;
  if (f.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <input id={id} type="checkbox" className="size-4 accent-sky-500" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
        {f.label}
      </label>
    );
  }
  return (
    <div className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
      <Label htmlFor={id}>{f.label}{f.required && " *"}</Label>
      {f.type === "textarea" ? (
        <Textarea id={id} rows={2} value={String(value)} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      ) : f.type === "select" ? (
        <select id={id} className={nativeSelectCls} value={String(value)} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input
          id={id}
          type={f.type === "number" ? "text" : (f.type ?? "text")}
          inputMode={f.type === "number" ? "decimal" : undefined}
          value={String(value)}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
        />
      )}
    </div>
  );
}

interface Props<T extends { id: string }> {
  eyebrow: string;
  title: string;
  description?: string;
  endpoint: string; // list + create
  itemPath?: (id: string) => string; // update + delete
  queryKey: string;
  noun: string;
  testPrefix: string;
  fields: FieldDef[];
  editFields?: FieldDef[];
  defaults: Record<string, unknown>;
  columns: ColumnDef<T>[];
  searchText?: (row: T) => string;
  filter?: (row: T) => boolean;
  rowActions?: (row: T) => ReactNode;
  above?: ReactNode;
  toolbar?: ReactNode;
  canDelete?: (row: T) => boolean;
  newLabel?: string;
}

export function ResourcePage<T extends { id: string }>(p: Props<T>) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: [p.queryKey], queryFn: () => apiGet<T[]>(p.endpoint) });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const itemPath = p.itemPath ?? ((id: string) => `${p.endpoint}/${id}`);
  const activeFields = editing && p.editFields ? p.editFields : p.fields;

  const openNew = () => {
    setEditing(null);
    setValues(toValues(p.fields, p.defaults));
    setOpen(true);
  };
  const openEdit = (row: T) => {
    setEditing(row);
    setValues(toValues(p.editFields ?? p.fields, row as unknown as Record<string, unknown>));
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = fromValues(activeFields, values);
      if (editing) {
        const base: Record<string, unknown> = {};
        if (!p.editFields) for (const k of Object.keys(p.defaults)) base[k] = (editing as unknown as Record<string, unknown>)[k];
        return apiPut<T>(itemPath(editing.id), { ...base, ...body });
      }
      return apiPost<T>(p.endpoint, { ...p.defaults, ...body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [p.queryKey] });
      toast.success(editing ? `${p.noun} atualizado(a)` : `${p.noun} cadastrado(a)`);
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível salvar")),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(itemPath(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [p.queryKey] });
      toast.success(`${p.noun} excluído(a)`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const term = q.trim().toLowerCase();
  const visible = rows.filter((r) => (!p.filter || p.filter(r)) && (!term || (p.searchText?.(r) ?? JSON.stringify(r)).toLowerCase().includes(term)));
  const missingRequired = activeFields.some((f) => f.required && !String(values[f.key] ?? "").trim());

  return (
    <div>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        actions={
          <Button onClick={openNew} data-testid={`${p.testPrefix}-new-button`}>
            <Plus className="size-4" /> {p.newLabel ?? `Novo(a) ${p.noun.toLowerCase()}`}
          </Button>
        }
      />
      {p.above}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} data-testid={`${p.testPrefix}-search-input`} />
          </div>
          {p.toolbar}
          <span className="ml-auto text-xs text-muted-foreground" data-testid={`${p.testPrefix}-count`}>{visible.length} registro(s)</span>
        </div>
        {isLoading ? (
          <div className="m-4 h-32 animate-pulse rounded-lg bg-white/5" />
        ) : visible.length === 0 ? (
          <EmptyState icon={Inbox} title="Nada por aqui ainda" text={`Clique em “${p.newLabel ?? "Novo"}” para cadastrar.`} testId={`${p.testPrefix}-empty-state`} />
        ) : (
          <Table data-testid={`${p.testPrefix}-table`}>
            <TableHeader>
              <TableRow>
                {p.columns.map((c) => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} data-testid={`${p.testPrefix}-row-${r.id}`}>
                  {p.columns.map((c) => <TableCell key={c.label} className={c.className}>{c.cell(r)}</TableCell>)}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.rowActions?.(r)}
                      <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => openEdit(r)} data-testid={`${p.testPrefix}-edit-${r.id}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {(!p.canDelete || p.canDelete(r)) && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Excluir"
                          className="hover:text-red-400"
                          onClick={() => window.confirm(`Excluir este(a) ${p.noun.toLowerCase()}?`) && del.mutate(r.id)}
                          data-testid={`${p.testPrefix}-delete-${r.id}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${p.noun.toLowerCase()}` : p.newLabel ?? `Novo(a) ${p.noun.toLowerCase()}`}</DialogTitle>
            <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            data-testid={`${p.testPrefix}-form`}
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            {activeFields.map((f) => (
              <FieldInput key={f.key} f={f} value={values[f.key] ?? ""} testPrefix={p.testPrefix} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
            ))}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} data-testid={`${p.testPrefix}-cancel-button`}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending || missingRequired} data-testid={`${p.testPrefix}-submit-button`}>
                {save.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
