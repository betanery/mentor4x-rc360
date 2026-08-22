import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "set-password">("signin");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // Detect invite/recovery flow from URL hash (Supabase appends #access_token=...&type=invite)
    const hash = window.location.hash;
    const isInviteOrRecovery = /type=(invite|recovery)/.test(hash);

    if (isInviteOrRecovery) {
      // Supabase auto-processes the hash and creates a session; just switch UI
      setMode("set-password");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (next.startsWith("/.lovable/")) window.location.href = next;
        else nav(next);
      }
    });
  }, [nav, next]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Bem-vindo de volta!");
      if (next.startsWith("/.lovable/")) window.location.href = next;
      else nav(next);
    }
  };

  const signInGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (error) toast.error(error.message);
  };

  const setNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("A senha deve ter ao menos 8 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não conferem"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    // Clear hash and go to dashboard
    window.history.replaceState(null, "", window.location.pathname);
    toast.success("Senha definida! Bem-vindo(a) ao Mentor 4X.");
    if (next.startsWith("/.lovable/")) window.location.href = next;
    else nav(next);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand side */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-gradient-hero text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative">
          <Logo dark />
        </div>
        <div className="relative space-y-6">
          <p className="text-[10px] font-bold tracking-[0.4em] text-gold uppercase">SEE_4X · RC360</p>
          <h1 className="text-5xl xl:text-6xl font-black leading-[1.05]">
            O céu não é<br /> o <span className="text-gold">limite.</span>
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Sua empresa está mais organizada hoje do que ontem. Transforme improviso em lucro previsível por execução orientada.
          </p>
        </div>
        <div className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} RC360 · Roberta Cardoso — Mentor 4X, plataforma do SEE_4X
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center"><Logo /></div>

          {mode === "set-password" ? (
            <>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Defina sua senha</h2>
                <p className="text-muted-foreground">Você foi convidado(a). Crie uma senha segura para acessar o sistema.</p>
              </div>
              <Card className="p-6 space-y-5 shadow-card">
                <form onSubmit={setNewPasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newpw">Nova senha</Label>
                    <Input id="newpw" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpw">Confirme a senha</Label>
                    <Input id="cpw" type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-brand hover:opacity-95" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Definir senha e entrar"}
                  </Button>
                </form>
              </Card>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Acesse o sistema</h2>
                <p className="text-muted-foreground">Entre com sua conta para continuar a jornada.</p>
              </div>

              <Card className="p-6 space-y-5 shadow-card">
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-brand hover:opacity-95" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={signInGoogle}>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Entrar com Google
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Não tem conta? Este sistema é por <strong>convite</strong>. Fale com seu Consultor 4X ou administrador.
                </p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
