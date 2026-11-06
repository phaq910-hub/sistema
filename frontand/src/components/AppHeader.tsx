import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { Role, User } from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false, staleTime: 60_000 });
}

/** Renders children only for the given role; redirects to /login otherwise. */
export function RequireRole({ role, children }: { role: Role; children: (user: User) => ReactNode }) {
  const { data, isLoading, isError } = useMe();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (isError || !data) return <Navigate to="/login" replace />;
  if (data.role !== role) return <Navigate to={data.role === "admin" ? "/admin" : "/tecnico"} replace />;
  return <>{children(data)}</>;
}

export function AppHeader({ user, right, subtitle }: { user: User; right?: ReactNode; subtitle: string }) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <BrandMark to={user.role === "admin" ? "/admin" : "/tecnico"} />
        <span className="hidden h-6 w-px bg-border sm:block" />
        <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:block">{subtitle}</span>
        <div className="ml-auto flex items-center gap-2">
          {right}
          <div className="hidden text-right md:block">
            <p data-testid="header-user-name" className="text-sm font-semibold leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" data-testid="logout-button" aria-label="Sair" onClick={() => endSession()}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
