import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard, Headset, CalendarClock, Wrench, Map, FileText, Users, Boxes, Truck, Wallet, HardHat, BookOpen,
  Building2, CreditCard, UserCog, QrCode, MessageCircle, Star, ChevronDown, Menu, X, LogOut, KeyRound, Package,
} from "lucide-react";
import { toast } from "sonner";
import { RequireRole } from "@/components/AppHeader";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBell } from "@/components/NotificationBell";
import { PushToggle } from "@/components/PushToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import { endSession } from "@/lib/session";
import { errorMessage } from "@/lib/format";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Icon = typeof LayoutDashboard;
interface NavItem { to: string; label: string; icon: Icon; id: string }
interface NavGroup { label: string; icon: Icon; id: string; children: NavItem[] }
type NavEntry = NavItem | NavGroup;

const NAV: NavEntry[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  {
    label: "Chamados", icon: Headset, id: "chamados-group",
    children: [
      { to: "/admin/chamados", label: "Chamados", icon: Headset, id: "chamados" },
      { to: "/admin/roteiro", label: "Roteiro do dia", icon: CalendarClock, id: "roteiro" },
      { to: "/admin/ordens", label: "Ordens de Serviço", icon: Wrench, id: "ordens" },
    ],
  },
  { to: "/admin/mapa", label: "Mapa da equipe", icon: Map, id: "mapa" },
  { to: "/admin/orcamentos", label: "Orçamentos", icon: FileText, id: "orcamentos" },
  { to: "/admin/clientes", label: "Clientes", icon: Users, id: "clientes" },
  {
    label: "Estoque", icon: Boxes, id: "estoque-group",
    children: [
      { to: "/admin/estoque", label: "Produtos", icon: Package, id: "estoque" },
      { to: "/admin/fornecedores", label: "Fornecedores", icon: Truck, id: "fornecedores" },
    ],
  },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, id: "financeiro" },
  { to: "/admin/tecnicos", label: "Técnicos", icon: HardHat, id: "tecnicos" },
  { to: "/admin/catalogo", label: "Catálogos", icon: BookOpen, id: "catalogo" },
  {
    label: "Minha empresa", icon: Building2, id: "empresa-group",
    children: [
      { to: "/admin/empresa", label: "Dados da empresa", icon: Building2, id: "empresa" },
      { to: "/admin/plano", label: "Plano e pagamento", icon: CreditCard, id: "plano" },
      { to: "/admin/funcionarios", label: "Funcionários", icon: UserCog, id: "funcionarios" },
      { to: "/admin/pix", label: "Recebimento (PIX)", icon: QrCode, id: "pix" },
    ],
  },
  { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, id: "whatsapp" },
  { to: "/admin/avaliacoes", label: "Avaliações", icon: Star, id: "avaliacoes" },
];

const itemCls = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
    active ? "bg-sky-500/15 text-sky-300 shadow-[inset_2px_0_0_rgb(56_189_248)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
  );

function Group({ g, onNavigate }: { g: NavGroup; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const hasActive = g.children.some((c) => pathname === c.to);
  const [open, setOpen] = useState(hasActive);
  const isOpen = open || hasActive;
  return (
    <div>
      <button type="button" onClick={() => setOpen(!isOpen)} className={cn(itemCls(false), "w-full", hasActive && "text-slate-100")} data-testid={`nav-${g.id}`}>
        <g.icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{g.label}</span>
        <ChevronDown className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-2">
          {g.children.map((c) => (
            <NavLink key={c.to} to={c.to} end onClick={onNavigate} className={({ isActive }) => itemCls(isActive)} data-testid={`nav-${c.id}`}>
              <c.icon className="size-3.5 shrink-0" /> {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav className="space-y-0.5" data-testid="admin-sidebar-nav">
      {NAV.map((e) =>
        "children" in e ? (
          <Group key={e.id} g={e} onNavigate={onNavigate} />
        ) : (
          <NavLink key={e.to} to={e.to} end onClick={onNavigate} className={({ isActive }) => itemCls(isActive)} data-testid={`nav-${e.id}`}>
            <e.icon className="size-4 shrink-0" /> {e.label}
          </NavLink>
        ),
      )}
    </nav>
  );
}

function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const save = useMutation({
    mutationFn: () => apiPost("/auth/password", { current, new: next }),
    onSuccess: () => {
      toast.success("Senha alterada");
      setCurrent("");
      setNext("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Minha conta</DialogTitle>
          <DialogDescription>Altere a sua senha de acesso.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="acc-current">Senha atual</Label>
          <Input id="acc-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} data-testid="account-current-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-new">Nova senha</Label>
          <Input id="acc-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} data-testid="account-new-password" />
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || next.length < 4 || !current} data-testid="account-save-button">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Shell({ user }: { user: User }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const close = () => setMobileOpen(false);
  const footer = (
    <div className="space-y-1 border-t border-white/10 pt-3">
      <button type="button" className={cn(itemCls(false), "w-full")} onClick={() => setAccountOpen(true)} data-testid="nav-minha-conta">
        <KeyRound className="size-4" /> Minha conta
      </button>
      <button type="button" className={cn(itemCls(false), "w-full hover:text-red-300")} onClick={() => endSession()} data-testid="logout-button">
        <LogOut className="size-4" /> Sair
      </button>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-[1200] hidden w-64 flex-col gap-4 border-r border-white/10 bg-[#080C14]/95 p-4 backdrop-blur-xl lg:flex">
        <div className="px-1 py-1"><BrandMark to="/admin" /></div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1"><Sidebar onNavigate={close} /></div>
        {footer}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[1300] lg:hidden">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/60" onClick={close} data-testid="mobile-nav-backdrop" />
          <aside className="relative flex h-full w-72 flex-col gap-4 border-r border-white/10 bg-[#080C14] p-4 animate-rise">
            <div className="flex items-center justify-between">
              <BrandMark to="/admin" />
              <Button size="icon-sm" variant="ghost" onClick={close} aria-label="Fechar" data-testid="mobile-nav-close"><X className="size-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto"><Sidebar onNavigate={close} /></div>
            {footer}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-[1100] flex h-16 items-center gap-3 border-b border-white/10 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" data-testid="mobile-nav-open">
          <Menu className="size-5" />
        </Button>
        <div className="lg:hidden"><BrandMark to="/admin" compact /></div>
        <div className="ml-auto flex items-center gap-3">
          <PushToggle />
          <NotificationBell />
          <div className="hidden text-right sm:block">
            <p data-testid="header-user-name" className="text-sm font-semibold leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet context={user} />
      </main>
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}

export default function AdminLayout() {
  return <RequireRole role="admin">{(user) => <Shell user={user} />}</RequireRole>;
}

export const useAdminUser = () => useOutletContext<User>();

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">{eyebrow}</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold" data-testid="page-title">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, accent, testId }: { label: string; value: ReactNode; hint?: string; accent: string; testId: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", accent)} />
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold" data-testid={testId}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: I, title, text, testId }: { icon: Icon; title: string; text: string; testId: string }) {
  return (
    <div className="px-6 py-14 text-center" data-testid={testId}>
      <I className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
