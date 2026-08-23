import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { Award, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Result = {
  valid: boolean;
  code?: string;
  issued_at?: string;
  company_name?: string | null;
  journey_stage?: string | null;
  reason?: string;
};

const REASON: Record<string, string> = {
  not_found: "Não encontramos nenhum certificado com este código.",
  invalid_format: "Código inválido. Confira os caracteres impressos no certificado.",
  lookup_failed: "Não foi possível consultar agora. Tente novamente em instantes.",
  unexpected_error: "Não foi possível consultar agora. Tente novamente em instantes.",
};

export default function Verify() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(routeCode ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const check = async (value: string) => {
    const target = value.trim();
    if (!target) return;
    setLoading(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("verify-certificate", { body: { code: target } });
    setLoading(false);
    if (error) {
      setResult({ valid: false, reason: "lookup_failed" });
      return;
    }
    setResult(data as Result);
  };

  useEffect(() => {
    if (routeCode) {
      setCode(routeCode);
      check(routeCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = code.trim();
    if (!target) return;
    if (target !== routeCode) navigate(`/validar/${encodeURIComponent(target)}`);
    else check(target);
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col items-center px-4 py-14">
      <header className="w-full max-w-2xl flex items-center justify-between">
        <Logo />
        <Link to="/auth" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          Acessar plataforma
        </Link>
      </header>

      <main className="w-full max-w-2xl mt-10 space-y-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Verificação pública</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">Validar certificação SEE_4X</h1>
          <p className="mt-3 text-muted-foreground">
            Informe o código impresso no certificado para confirmar sua autenticidade junto à RC360.
          </p>
        </div>

        <Card className="p-6 shadow-card">
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex.: 4X-A1B2C3D4"
              aria-label="Código do certificado"
              className="font-mono tracking-wider"
            />
            <Button type="submit" disabled={loading || !code.trim()} className="bg-gradient-brand">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Verificar
            </Button>
          </form>
        </Card>

        {result?.valid && (
          <Card className="p-8 shadow-elegant bg-gradient-brand text-primary-foreground relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-48 w-48 bg-gold/15 rounded-full blur-3xl" />
            <div className="relative flex items-start gap-4">
              <Award className="h-12 w-12 text-gold shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-gold text-xs font-bold tracking-widest uppercase">
                  <CheckCircle2 className="h-4 w-4" /> Certificado autêntico
                </div>
                <h2 className="text-2xl font-black mt-2 break-words">{result.company_name ?? "Empresa certificada"}</h2>
                <p className="mt-2 text-primary-foreground/80 text-sm">
                  Certificação emitida em{" "}
                  {format(new Date(result.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} pela metodologia
                  SEE_4X — Sistema de Estruturação Empresarial 4X, assinatura RC360.
                </p>
                <p className="mt-4 font-mono text-xs text-primary-foreground/70">Código #{result.code}</p>
              </div>
            </div>
          </Card>
        )}

        {result && !result.valid && (
          <Card className="p-8 shadow-card border-destructive/30">
            <div className="flex items-start gap-4">
              <XCircle className="h-10 w-10 text-destructive shrink-0" />
              <div>
                <h2 className="text-xl font-bold">Certificado não validado</h2>
                <p className="mt-2 text-sm text-muted-foreground">{REASON[result.reason] ?? REASON.not_found}</p>
              </div>
            </div>
          </Card>
        )}
      </main>

      <footer className="mt-auto pt-12 text-xs text-muted-foreground">
        RC360 · Roberta Cardoso — Sistema de Estruturação Empresarial 4X
      </footer>
    </div>
  );
}
