import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { ScaleLegend, ScaleQuestion } from "@/components/ScaleQuestion";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { PILLAR_LABEL } from "@/lib/labels";
import {
  BLINDSPOTS,
  GROUP_LABEL,
  IDD_DIMENSIONS,
  MATURITY_DIMENSIONS,
  type Answers,
  type Pillar,
  type RespondentGroup,
} from "@/lib/see4x";

const PILLARS: Pillar[] = ["crescimento", "eficiencia", "encantamento", "lideranca"];

type Resolved = {
  company_name: string;
  invite_kind: "geral" | "individual";
  full_name: string | null;
  role_title: string | null;
  respondent_group: RespondentGroup;
  already_responded: boolean;
};

/** Página pública de resposta ao Diagnóstico 4X por link. */
export default function DiagnosticRespond() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [info, setInfo] = useState<Resolved | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [identity, setIdentity] = useState({ full_name: "", role_title: "", respondent_group: "equipe" as RespondentGroup });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("diagnostic-response", {
        body: { action: "resolve", token },
      });
      if (!active) return;
      const payload = (data ?? {}) as Partial<Resolved> & { message?: string };
      if (error || !payload.company_name) {
        setBlocked(payload.message ?? "Este link não é válido ou já foi encerrado.");
      } else {
        const resolved = payload as Resolved;
        setInfo(resolved);
        setIdentity({
          full_name: resolved.full_name ?? "",
          role_title: resolved.role_title ?? "",
          respondent_group: resolved.respondent_group ?? "equipe",
        });
        if (resolved.already_responded) setDone(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const answered = useMemo(() => BLINDSPOTS.filter((b) => answers[b.code]).length, [answers]);
  const complete = answered === BLINDSPOTS.length && identity.full_name.trim().length > 1;

  const submit = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("diagnostic-response", {
      body: {
        action: "submit",
        token,
        full_name: identity.full_name,
        role_title: identity.role_title,
        respondent_group: identity.respondent_group,
        answers,
      },
    });
    setSending(false);
    const payload = (data ?? {}) as { ok?: boolean; message?: string };
    if (error || !payload.ok) {
      toast.error(payload.message ?? "Não foi possível enviar suas respostas. Tente novamente.");
      return;
    }
    setDone(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <span className="text-xs text-muted-foreground">Diagnóstico 4X</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {blocked ? (
          <Card className="p-10 text-center">
            <h1 className="text-xl font-black">Link indisponível</h1>
            <p className="text-sm text-muted-foreground mt-2">{blocked}</p>
          </Card>
        ) : done ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <h1 className="text-xl font-black mt-4">Resposta registrada</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Obrigado. Sua leitura entra na consolidação do Diagnóstico 4X de {info?.company_name} e será apresentada pelo
              Consultor 4X.
            </p>
          </Card>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-black">Diagnóstico 4X · {info?.company_name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                São 20 afirmações sobre a empresa, mais dependência do dono e estrutura. Leva cerca de 10 minutos e não existe
                resposta certa — o valor está na sinceridade.
              </p>
            </div>

            <Card className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Seu nome *</Label>
                  <Input
                    id="full_name"
                    maxLength={120}
                    value={identity.full_name}
                    onChange={(e) => setIdentity((s) => ({ ...s, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role_title">Seu cargo</Label>
                  <Input
                    id="role_title"
                    maxLength={120}
                    placeholder="Ex.: Diretor comercial"
                    value={identity.role_title}
                    onChange={(e) => setIdentity((s) => ({ ...s, role_title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Seu papel na empresa</Label>
                  <Select
                    value={identity.respondent_group}
                    onValueChange={(v) => setIdentity((s) => ({ ...s, respondent_group: v as RespondentGroup }))}
                    disabled={info?.invite_kind === "individual"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GROUP_LABEL) as RespondentGroup[]).map((g) => (
                        <SelectItem key={g} value={g}>
                          {GROUP_LABEL[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Suas respostas são usadas apenas na consolidação do diagnóstico da empresa.
              </p>
              <div>
                <p className="text-sm text-muted-foreground">
                  {answered} de {BLINDSPOTS.length} afirmações principais respondidas
                </p>
                <Progress value={(answered / BLINDSPOTS.length) * 100} className="mt-2" />
              </div>
            </Card>

            {PILLARS.map((pillar) => (
              <Card key={pillar} className="p-5 space-y-3">
                <div>
                  <h2 className="font-bold">{PILLAR_LABEL[pillar].label}</h2>
                  <p className="text-xs text-muted-foreground">{PILLAR_LABEL[pillar].description}</p>
                </div>
                <ScaleLegend />
                {BLINDSPOTS.filter((b) => b.pillar === pillar).map((bs) => (
                  <ScaleQuestion
                    key={bs.code}
                    id={bs.code}
                    statement={bs.statement}
                    value={answers[bs.code]}
                    onChange={(v) => setAnswers((a) => ({ ...a, [bs.code]: v }))}
                  />
                ))}
              </Card>
            ))}

            <Card className="p-5 space-y-3">
              <div>
                <h2 className="font-bold">O quanto a empresa roda sem o dono</h2>
                <p className="text-xs text-muted-foreground">Oito dimensões de dependência do dono.</p>
              </div>
              <ScaleLegend />
              {IDD_DIMENSIONS.map((d) => (
                <ScaleQuestion
                  key={d.key}
                  id={`IDD-${d.key}`}
                  statement={d.statement}
                  value={answers[`IDD-${d.key}`]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [`IDD-${d.key}`]: v }))}
                />
              ))}
            </Card>

            <Card className="p-5 space-y-3">
              <div>
                <h2 className="font-bold">Estrutura instalada</h2>
                <p className="text-xs text-muted-foreground">Oito dimensões de estrutura e governança.</p>
              </div>
              <ScaleLegend />
              {MATURITY_DIMENSIONS.map((d) => (
                <ScaleQuestion
                  key={d.key}
                  id={`MAT-${d.key}`}
                  statement={d.statement}
                  value={answers[`MAT-${d.key}`]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [`MAT-${d.key}`]: v }))}
                />
              ))}
            </Card>

            <div className="flex items-center justify-end gap-3 pb-10">
              <Button onClick={submit} disabled={!complete || sending} className="bg-gradient-brand">
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar minhas respostas
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
