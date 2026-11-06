import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, MessageCircle, ExternalLink, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, money, publicUrl, whatsappLink } from "@/lib/format";
import type { CatalogItem, PublicCompany, Quote, QuoteCreate, Ticket, User } from "@/lib/types";
import { ClientPicker } from "@/components/ClientPicker";
import { nativeSelectCls } from "@/components/ResourcePage";

interface ItemDraft {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
}

const emptyItem = (): ItemDraft => ({ key: crypto.randomUUID(), description: "", quantity: "1", unit_price: "" });

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const NONE = "__none__";

export function quoteShareText(q: Quote, company = "Techline Consultoria"): string {
  return `Olá ${q.client_name}! Segue o orçamento #${q.number} da ${company} no valor de ${money(q.total)}. Para aprovar ou recusar, acesse: ${publicUrl(`/orcamento/${q.id}`)}`;
}

export function ShareQuoteDialog({ quote, onClose }: { quote: Quote | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: company } = useQuery({ queryKey: ["public-company"], queryFn: () => apiGet<PublicCompany>("/public/company") });
  const autoSend = useMutation({
    mutationFn: (id: string) => apiPost(`/quotes/${id}/send-whatsapp`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento enviado pelo seu WhatsApp!");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível enviar"), { description: "Conecte o WhatsApp na aba WhatsApp ou use o botão manual." }),
  });
  if (!quote) return null;
  const link = publicUrl(`/orcamento/${quote.id}`);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar orçamento #{quote.number}</DialogTitle>
          <DialogDescription>Envie o link para {quote.client_name} aprovar ou recusar.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-secondary/50 p-3 font-mono text-xs break-all text-sky-300" data-testid="share-quote-link">
          {link}
        </div>
        <Button
          data-testid="share-auto-whatsapp-button"
          className="h-11 bg-emerald-600 text-white hover:bg-emerald-500"
          disabled={autoSend.isPending || !quote.client_phone}
          onClick={() => autoSend.mutate(quote.id)}
        >
          <Zap className="size-4" /> {autoSend.isPending ? "Enviando…" : quote.client_phone ? "Enviar agora pelo meu WhatsApp" : "Cliente sem telefone"}
        </Button>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            data-testid="share-copy-link-button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast.success("Link copiado!");
            }}
          >
            <Copy className="size-4" /> Copiar link
          </Button>
          <a
            data-testid="share-whatsapp-button"
            href={whatsappLink(quote.client_phone, quoteShareText(quote, company?.name))}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <MessageCircle className="size-4" /> Abrir no WhatsApp
          </a>
        </div>
        <DialogFooter>
          <a data-testid="share-open-link" href={link} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
            <ExternalLink className="size-4" /> Ver como cliente
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteFormDialog({
  open,
  onOpenChange,
  onCreated,
  ticket = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (q: Quote) => void;
  ticket?: Ticket | null;
}) {
  const qc = useQueryClient();
  const { data: techs = [] } = useQuery({ queryKey: ["technicians"], queryFn: () => apiGet<User[]>("/technicians") });
  const { data: catalog = [] } = useQuery({ queryKey: ["catalog"], queryFn: () => apiGet<CatalogItem[]>("/catalog") });
  const [client, setClient] = useState({ name: "", phone: "", email: "", address: "" });
  const [clientId, setClientId] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [discount, setDiscount] = useState("0");
  const [validUntil, setValidUntil] = useState(plusDays(15));
  const [notes, setNotes] = useState("");
  const [techId, setTechId] = useState(NONE);

  const parsed = items.map((i) => ({
    description: i.description.trim(),
    quantity: Number(i.quantity.replace(",", ".")) || 0,
    unit_price: Number(i.unit_price.replace(",", ".")) || 0,
  }));
  const subtotal = parsed.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const disc = Number(discount.replace(",", ".")) || 0;
  const total = Math.max(subtotal - disc, 0);

  // Prefill from the chamado the quote is being opened for.
  useEffect(() => {
    if (open && ticket) {
      setTicketId(ticket.id);
      setClientId(ticket.client_id);
      setClient((c) => ({ ...c, name: ticket.client_name, phone: ticket.client_phone, address: ticket.client_address }));
      setNotes((n) => n || ticket.description);
      setItems((l) => (l.length === 1 && !l[0].description ? [{ ...emptyItem(), description: ticket.title }] : l));
    }
  }, [open, ticket]);

  const addCatalog = (id: string) => {
    const c = catalog.find((x) => x.id === id);
    if (!c) return;
    setItems((l) => [...l.filter((i) => i.description.trim()), { key: crypto.randomUUID(), description: c.name, quantity: "1", unit_price: String(c.price) }]);
  };

  const reset = () => {
    setClient({ name: "", phone: "", email: "", address: "" });
    setClientId("");
    setTicketId(null);
    setItems([emptyItem()]);
    setDiscount("0");
    setValidUntil(plusDays(15));
    setNotes("");
    setTechId(NONE);
  };

  const create = useMutation({
    mutationFn: (body: QuoteCreate) => apiPost<Quote>("/quotes", body),
    onSuccess: (q) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`Orçamento #${q.number} criado`);
      reset();
      onOpenChange(false);
      onCreated(q);
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível criar o orçamento")),
  });

  const submit = () => {
    if (!client.name.trim()) return toast.error("Informe o nome do cliente");
    const valid = parsed.filter((i) => i.description && i.quantity > 0);
    if (!valid.length) return toast.error("Adicione ao menos um item com descrição e quantidade");
    create.mutate({
      client_name: client.name.trim(),
      client_phone: client.phone.trim(),
      client_email: client.email.trim(),
      client_address: client.address.trim(),
      items: valid,
      discount: disc,
      valid_until: validUntil,
      notes: notes.trim(),
      technician_id: techId === NONE ? null : techId,
      client_id: clientId || null,
      ticket_id: ticketId,
    });
  };

  const setItem = (idx: number, patch: Partial<ItemDraft>) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const techLabel = (v: string) => (v === NONE ? "Atribuir depois" : techs.find((t) => t.id === v)?.name ?? "Técnico");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Novo orçamento</DialogTitle>
          <DialogDescription>Preencha os dados do cliente, os itens e a validade da proposta.</DialogDescription>
        </DialogHeader>

        {ticketId && ticket && (
          <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-200" data-testid="quote-ticket-banner">
            Vinculado ao chamado <span className="font-mono">#{ticket.number}</span> — {ticket.title}
          </p>
        )}
        <div className="space-y-1.5">
          <Label>Cliente cadastrado</Label>
          <ClientPicker
            value={clientId}
            testPrefix="quote"
            onChange={(c) => {
              setClientId(c?.id ?? "");
              if (c) setClient({ name: c.name, phone: c.phone, email: c.email, address: c.address });
            }}
          />
        </div>
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="q-name">Cliente *</Label>
            <Input id="q-name" data-testid="quote-client-name-input" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Nome ou empresa" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-phone">WhatsApp / Telefone</Label>
            <Input id="q-phone" data-testid="quote-client-phone-input" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="(11) 99999-0000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-email">E-mail</Label>
            <Input id="q-email" data-testid="quote-client-email-input" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="cliente@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-address">Endereço do atendimento</Label>
            <Input id="q-address" data-testid="quote-client-address-input" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Itens</p>
            {catalog.length > 0 && (
              <select className={`${nativeSelectCls} ml-auto mr-2 h-8 w-auto`} value="" onChange={(e) => addCatalog(e.target.value)} data-testid="quote-catalog-select">
                <option value="">+ Do catálogo…</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} — {money(c.price)}</option>)}
              </select>
            )}
            <Button size="sm" variant="outline" data-testid="quote-add-item-button" onClick={() => setItems((l) => [...l, emptyItem()])}>
              <Plus className="size-4" /> Item
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.key} className="grid grid-cols-[1fr_70px_110px_36px] items-center gap-2 sm:grid-cols-[1fr_80px_130px_110px_36px]">
                <Input data-testid={`quote-item-description-${idx}`} value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="Descrição do serviço/produto" />
                <Input data-testid={`quote-item-quantity-${idx}`} inputMode="decimal" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} placeholder="Qtd" />
                <Input data-testid={`quote-item-price-${idx}`} inputMode="decimal" value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: e.target.value })} placeholder="Valor unit." />
                <span className="hidden text-right font-mono text-sm text-sky-300 sm:block">{money(parsed[idx].quantity * parsed[idx].unit_price)}</span>
                <Button size="icon-sm" variant="ghost" data-testid={`quote-item-remove-${idx}`} disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, i) => i !== idx))} aria-label="Remover item">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="q-discount">Desconto (R$)</Label>
            <Input id="q-discount" data-testid="quote-discount-input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-valid">Válido até</Label>
            <Input id="q-valid" type="date" data-testid="quote-valid-until-input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Técnico (ao aprovar)</Label>
            <Select value={techId} onValueChange={(v: string) => setTechId(v)}>
              <SelectTrigger data-testid="quote-technician-select" className="w-full">
                <SelectValue>{(v) => techLabel(v as string)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Atribuir depois</SelectItem>
                {techs.map((t) => (
                  <SelectItem key={t.id} value={t.id} data-testid={`quote-technician-option-${t.id}`}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <div className="space-y-1.5">
          <Label htmlFor="q-notes">Observações / condições</Label>
          <Textarea id="q-notes" data-testid="quote-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prazo de execução, forma de pagamento, garantia…" rows={2} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>Subtotal: <span className="font-mono text-foreground" data-testid="quote-subtotal">{money(subtotal)}</span></p>
            <p>Desconto: <span className="font-mono text-foreground">− {money(disc)}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="font-mono text-2xl font-semibold text-sky-300" data-testid="quote-total">{money(total)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="quote-cancel-button">Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending} data-testid="create-quote-submit">
            {create.isPending ? "Salvando…" : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
