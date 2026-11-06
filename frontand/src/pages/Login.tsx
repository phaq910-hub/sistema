import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ClipboardCheck, MapPin, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errorMessage } from "@/lib/format";
import type { User } from "@/lib/types";

const FEATURES = [
  { icon: ClipboardCheck, title: "Aprovação por link", text: "O cliente aprova ou recusa o orçamento com um toque." },
  { icon: Radio, title: "OS automática", text: "Aprovou? A ordem de serviço chega ao técnico na hora." },
  { icon: MapPin, title: "GPS ao vivo", text: "O cliente acompanha o técnico no mapa em tempo real." },
];

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => apiPost<User>("/auth/login", { email, password }),
    onSuccess: (user) => {
      beginSession();
      qc.setQueryData(["me"], user);
      navigate(user.role === "admin" ? "/admin" : "/tecnico", { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e, "Falha no login")),
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-[#0B1329] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -left-32 top-1/3 size-[520px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative"><BrandMark to="/login" /></div>
        <div className="relative max-w-lg">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Orçamentos · OS · Rastreamento</p>
          <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight">
            Do orçamento aprovado ao técnico na porta — <span className="text-sky-400">ao vivo.</span>
          </h1>
          <div className="mt-10 space-y-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur"
              >
                <f.icon className="mt-0.5 size-5 shrink-0 text-sky-400" />
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-slate-400">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Techline Consultoria</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
          className="w-full max-w-sm space-y-6"
          data-testid="login-form"
        >
          <div className="lg:hidden"><BrandMark to="/login" /></div>
          <div>
            <h2 className="font-heading text-3xl font-bold">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acesso para administradores e técnicos.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" data-testid="login-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@techline.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" data-testid="login-password-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={login.isPending} data-testid="login-submit-button">
            {login.isPending ? "Entrando…" : "Entrar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Técnicos são cadastrados pelo administrador no painel.
          </p>
        </motion.form>
      </main>
    </div>
  );
}
