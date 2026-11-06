import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Kpi } from "@/components/AdminLayout";
import { ResourcePage, type ColumnDef, type FieldDef } from "@/components/ResourcePage";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { dateBR, errorMessage, money, monthKey, monthLabel, shiftMonth } from "@/lib/format";
import type { CatalogItem, Client, FinanceEntry, Product, Supplier, User } from "@/lib/types";
import { useToday } from "@/pages/admin/Tickets";
import { cn } from "@/lib/utils";

const contactFields: FieldDef[] = [
  { key: "name", label: "Nome / Razão social", required: true, wide: true },
  { key: "document", label: "CPF / CNPJ" },
  { key: "phone", label: "WhatsApp / Telefone", placeholder: "(11) 99999-0000" },
  { key: "email", label: "E-mail", type: "email" },
];
const contactDefaults = { name: "", document: "", phone: "", email: "", notes: "" };
const muted = (v: string) => <span className="text-sm text-muted-foreground">{v || "—"}</span>;

export function ClientsPage() {
  const columns: ColumnDef<Client>[] = [
    { label: "Cliente", cell: (c) => <><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.document}</p></> },
    { label: "Contato", cell: (c) => <><p className="text-sm">{c.phone || "—"}</p><p className="text-xs text-muted-foreground">{c.email}</p></> },
    { label: "Endereço", cell: (c) => <span className="block max-w-[280px] truncate text-sm text-muted-foreground">{c.address || "—"}</span> },
  ];
  return (
    <ResourcePage<Client>
      eyebrow="Cadastros" title="Clientes" description="Clientes cadastrados aparecem para seleção ao abrir chamados e orçamentos."
      endpoint="/clients" queryKey="clients" noun="Cliente" testPrefix="client" newLabel="Novo cliente"
      fields={[...contactFields, { key: "address", label: "Endereço do atendimento", wide: true }, { key: "notes", label: "Observações", type: "textarea", wide: true }]}
      defaults={{ ...contactDefaults, address: "" }} columns={columns}
    />
  );
}

export function SuppliersPage() {
  const columns: ColumnDef<Supplier>[] = [
    { label: "Fornecedor", cell: (s) => <><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.document}</p></> },
    { label: "Categoria", cell: (s) => muted(s.category) },
    { label: "Contato", cell: (s) => <><p className="text-sm">{s.phone || "—"}</p><p className="text-xs text-muted-foreground">{s.email}</p></> },
  ];
  return (
    <ResourcePage<Supplier>
      eyebrow="Estoque" title="Fornecedores" endpoint="/suppliers" queryKey="suppliers" noun="Fornecedor" testPrefix="supplier" newLabel="Novo fornecedor"
      fields={[...contactFields, { key: "category", label: "Categoria", placeholder: "Peças, ferramentas…" }, { key: "notes", label: "Observações", type: "textarea", wide: true }]}
      defaults={{ ...contactDefaults, category: "" }} columns={columns}
    />
  );
}

export function ProductsPage() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => apiGet<Supplier[]>("/suppliers") });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => apiGet<Product[]>("/products") });
  const adjust = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => apiPost<Product>(`/products/${id}/adjust`, { delta }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const low = products.filter((p) => p.quantity <= p.min_quantity);
  const columns: ColumnDef<Product>[] = [
    { label: "Produto", cell: (p) => <><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-muted-foreground">{p.sku || "sem código"} · {p.category || "geral"}</p></> },
    {
      label: "Estoque",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="outline" aria-label="Diminuir" onClick={() => adjust.mutate({ id: p.id, delta: -1 })} data-testid={`product-dec-${p.id}`}><Minus className="size-3" /></Button>
          <span className={cn("min-w-12 text-center font-mono", p.quantity <= p.min_quantity && "text-red-400")} data-testid={`product-qty-${p.id}`}>{p.quantity} {p.unit}</span>
          <Button size="icon-sm" variant="outline" aria-label="Aumentar" onClick={() => adjust.mutate({ id: p.id, delta: 1 })} data-testid={`product-inc-${p.id}`}><Plus className="size-3" /></Button>
        </div>
      ),
    },
    { label: "Custo / Venda", cell: (p) => <span className="font-mono text-sm">{money(p.cost)} / {money(p.price)}</span> },
    { label: "Fornecedor", cell: (p) => muted(p.supplier_name ?? "") },
  ];
  return (
    <ResourcePage<Product>
      eyebrow="Estoque" title="Produtos" description="Controle de peças e materiais. Itens abaixo do mínimo ficam em vermelho."
      endpoint="/products" queryKey="products" noun="Produto" testPrefix="product" newLabel="Novo produto"
      above={low.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300" data-testid="products-low-alert">
          <AlertTriangle className="size-4" /> {low.length} produto(s) com estoque baixo: {low.map((p) => p.name).join(", ")}
        </p>
      )}
      fields={[
        { key: "name", label: "Nome", required: true, wide: true },
        { key: "sku", label: "Código / SKU" },
        { key: "category", label: "Categoria" },
        { key: "quantity", label: "Quantidade", type: "number" },
        { key: "min_quantity", label: "Estoque mínimo", type: "number" },
        { key: "unit", label: "Unidade", placeholder: "un, m, kg…" },
        { key: "supplier_id", label: "Fornecedor", type: "select", nullable: true, options: [{ value: "", label: "—" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))] },
        { key: "cost", label: "Custo (R$)", type: "number" },
        { key: "price", label: "Preço de venda (R$)", type: "number" },
      ]}
      defaults={{ name: "", sku: "", category: "", unit: "un", quantity: 0, min_quantity: 0, cost: 0, price: 0, supplier_id: null }}
      columns={columns}
    />
  );
}

export function CatalogPage() {
  const columns: ColumnDef<CatalogItem>[] = [
    { label: "Item", cell: (c) => <><p className="font-medium">{c.name}</p><p className="max-w-[320px] truncate text-xs text-muted-foreground">{c.description}</p></> },
    { label: "Tipo", cell: (c) => <span className="rounded-full border border-border px-2 py-0.5 text-xs">{c.kind === "servico" ? "Serviço" : "Produto"}</span> },
    { label: "Preço", cell: (c) => <span className="font-mono">{money(c.price)}</span> },
  ];
  return (
    <ResourcePage<CatalogItem>
      eyebrow="Comercial" title="Catálogos" description="Serviços e produtos com preço padrão — adicione-os com um clique ao montar orçamentos."
      endpoint="/catalog" queryKey="catalog" noun="Item" testPrefix="catalog" newLabel="Novo item"
      fields={[
        { key: "name", label: "Nome", required: true, wide: true },
        { key: "kind", label: "Tipo", type: "select", options: [{ value: "servico", label: "Serviço" }, { value: "produto", label: "Produto" }] },
        { key: "price", label: "Preço (R$)", type: "number" },
        { key: "description", label: "Descrição", type: "textarea", wide: true },
      ]}
      defaults={{ name: "", description: "", kind: "servico", price: 0 }} columns={columns}
    />
  );
}

const userColumns: ColumnDef<User>[] = [
  { label: "Nome", cell: (u) => <span className="font-medium">{u.name}</span> },
  { label: "E-mail (login)", cell: (u) => muted(u.email) },
  { label: "Telefone", cell: (u) => <span className="text-sm">{u.phone || "—"}</span> },
];
const userCreateFields: FieldDef[] = [
  { key: "name", label: "Nome", required: true, wide: true },
  { key: "email", label: "E-mail de login", type: "email", required: true },
  { key: "password", label: "Senha", type: "password", required: true },
  { key: "phone", label: "Telefone / WhatsApp" },
];
const userEditFields: FieldDef[] = [
  { key: "name", label: "Nome", required: true, wide: true },
  { key: "phone", label: "Telefone / WhatsApp" },
  { key: "password", label: "Nova senha (deixe vazio para manter)", type: "password" },
];

export function TechniciansPage() {
  return (
    <ResourcePage<User>
      eyebrow="Equipe" title="Técnicos" description="Crie o acesso de cada técnico. Eles entram em /login com o e-mail e a senha definidos aqui e recebem as OS no celular."
      endpoint="/technicians" itemPath={(id) => `/users/${id}`} queryKey="technicians" noun="Técnico" testPrefix="technician" newLabel="Novo técnico"
      fields={userCreateFields} editFields={userEditFields} defaults={{ name: "", email: "", password: "", phone: "" }} columns={userColumns}
    />
  );
}

export function StaffPage() {
  return (
    <ResourcePage<User>
      eyebrow="Minha empresa" title="Funcionários" description="Usuários com acesso ao painel administrativo (escritório, atendimento)."
      endpoint="/staff" itemPath={(id) => `/users/${id}`} queryKey="staff" noun="Funcionário" testPrefix="staff" newLabel="Novo funcionário"
      fields={userCreateFields} editFields={userEditFields} defaults={{ name: "", email: "", password: "", phone: "" }} columns={userColumns}
    />
  );
}

export function FinancePage() {
  const qc = useQueryClient();
  const { data: today } = useToday();
  const { data: entries = [] } = useQuery({ queryKey: ["finance"], queryFn: () => apiGet<FinanceEntry[]>("/finance") });
  const [month, setMonth] = useState<string | null>(null);
  const [kind, setKind] = useState<"todos" | "receber" | "pagar">("todos");
  const current = month ?? (today ? monthKey(today.today) : "");
  const toggle = useMutation({
    mutationFn: (id: string) => apiPost<FinanceEntry>(`/finance/${id}/toggle-paid`),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success(f.paid ? "Marcado como quitado" : "Marcado como em aberto");
    },
  });
  const inMonth = entries.filter((e) => monthKey(e.due_date) === current);
  const sum = (k: "receber" | "pagar", paid?: boolean) => inMonth.filter((e) => e.kind === k && (paid === undefined || e.paid === paid)).reduce((s, e) => s + e.amount, 0);
  const overdue = (e: FinanceEntry) => !e.paid && !!today && e.due_date < today.today;

  const columns: ColumnDef<FinanceEntry>[] = [
    {
      label: "Status",
      cell: (e) => (
        <button type="button" onClick={() => toggle.mutate(e.id)} className="flex items-center gap-1.5 text-xs font-semibold" data-testid={`finance-toggle-${e.id}`}>
          {e.paid ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className={cn("size-4", overdue(e) ? "text-red-400" : "text-muted-foreground")} />}
          {e.paid ? "Quitado" : overdue(e) ? "Vencido" : "Em aberto"}
        </button>
      ),
    },
    { label: "Descrição", cell: (e) => <><p className="font-medium">{e.description}</p><p className="text-xs text-muted-foreground">{e.party}{e.category ? ` · ${e.category}` : ""}</p></> },
    { label: "Vencimento", cell: (e) => <span className="text-sm">{dateBR(e.due_date)}</span> },
    { label: "Valor", cell: (e) => <span className={cn("font-mono", e.kind === "receber" ? "text-emerald-400" : "text-red-400")}>{e.kind === "receber" ? "+" : "−"} {money(e.amount)}</span> },
  ];

  return (
    <ResourcePage<FinanceEntry>
      eyebrow="Gestão" title="Financeiro" description="Contas a receber e a pagar. Orçamentos aprovados entram automaticamente como valores a receber."
      endpoint="/finance" queryKey="finance" noun="Lançamento" testPrefix="finance" newLabel="Novo lançamento"
      filter={(e) => monthKey(e.due_date) === current && (kind === "todos" || e.kind === kind)}
      above={
        <div className="mb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="outline" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(current, -1))} data-testid="finance-prev-month"><ChevronLeft className="size-4" /></Button>
            <span className="min-w-40 text-center font-heading font-bold capitalize" data-testid="finance-month-label">{current && monthLabel(current)}</span>
            <Button size="icon-sm" variant="outline" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(current, 1))} data-testid="finance-next-month"><ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="A receber" value={money(sum("receber", false))} hint={`recebido ${money(sum("receber", true))}`} accent="bg-emerald-400" testId="finance-kpi-receivable" />
            <Kpi label="A pagar" value={money(sum("pagar", false))} hint={`pago ${money(sum("pagar", true))}`} accent="bg-red-400" testId="finance-kpi-payable" />
            <Kpi label="Saldo previsto" value={money(sum("receber") - sum("pagar"))} hint="receitas − despesas do mês" accent="bg-sky-400" testId="finance-kpi-balance" />
            <Kpi label="Vencidos" value={inMonth.filter(overdue).length} hint="lançamentos em atraso" accent="bg-amber-400" testId="finance-kpi-overdue" />
          </div>
        </div>
      }
      toolbar={
        <div className="flex gap-1">
          {(["todos", "receber", "pagar"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              data-testid={`finance-filter-${k}`}
              className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150", kind === k ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-border text-muted-foreground")}
            >
              {k === "todos" ? "Todos" : k === "receber" ? "A receber" : "A pagar"}
            </button>
          ))}
        </div>
      }
      fields={[
        { key: "kind", label: "Tipo", type: "select", options: [{ value: "receber", label: "A receber (receita)" }, { value: "pagar", label: "A pagar (despesa)" }] },
        { key: "amount", label: "Valor (R$)", type: "number", required: true },
        { key: "description", label: "Descrição", required: true, wide: true },
        { key: "due_date", label: "Vencimento", type: "date", required: true },
        { key: "category", label: "Categoria", placeholder: "Serviços, peças, aluguel…" },
        { key: "party", label: "Cliente / fornecedor", wide: true },
        { key: "paid", label: "Já quitado", type: "checkbox" },
      ]}
      defaults={{ kind: "receber", description: "", amount: 0, due_date: today?.today ?? "", category: "", party: "", paid: false, quote_id: null }}
      columns={columns}
    />
  );
}
