import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { ANSWER_SCALE, BLINDSPOTS, IDD_DIMENSIONS, QUESTIONS, improvisoBand } from "@/lib/see4x";
import { CheckCircle2, Cloud, Loader2, Lock, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

type Lead = {
  resume_token: string;
  status: string;
  current_step: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  segment: string | null;
  revenue_band: string | null;
  team_size: string | null;
  role_title: string | null;
  answers: Record<string, number>;
  result: {
    improvisoGeral: number;
    band: { label: string };
    byPillar: { pillar: string; label: string; improviso: number }[];
    blindspots: { code: string; title: string; improviso: number }[];
    top5: string[];
    idd: { score: number };
    disclaimer: string;
  } | null;
  recommendation: { track: string; headline: string; why: string; next_steps: string[] } | null;
  completed_at: string | null;
};

const STORAGE_KEY = "mentor4x.lead_diagnostic.token";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const PILLARS = ["crescimento", "eficiencia", "encantamento", "lideranca"] as const;
const PILLAR_LABEL: Record<string, string> = {
  crescimento: "Crescimento",
  eficiencia: "Eficiência",
  encantamento: "Encantamento",
  lideranca: "Liderança",
};

/** Etapas: contexto → 4 pilares → IDD. */
const STEPS = [
  { key: "contexto", title: "Sua empresa", subtitle: "Contexto para calibrar a leitura" },
  ...PILLARS.map((p) => ({
    key: p,
    title: `Pilar ${PILLAR_LABEL[p]}`,
    subtitle: "Marque o quanto cada afirmação já é verdade hoje",
  })),
  { key: "idd", title: "Dependência do dono", subtitle: "O quanto a empresa roda sem você" },
];

export default function LeadDiagnostic() {
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [contact, setContact] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
    segment: "",
    revenue_band: "",
    team_size: "",
    role_title: "",
  });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("lead-diagnostic", { body: payload });
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return (data as { lead: Lead }).lead;
  }, []);

  const hydrate = useCallback((l: Lead) => {
    setLead(l);
    setAnswers(l.answers ?? {});
    setStep(Math.min(l.current_step ?? 0, STEPS.length - 1));
    setContact({
      full_name: l.full_name ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      company_name: l.company_name ?? "",
      segment: l.segment ?? "",
      revenue_band: l.revenue_band ?? "",
      team_size: l.team_size ?? "",
      role_title: l.role_title ?? "",
    });
  }, []);

  // Retomada: token da URL ou do storage local. Um novo registro só é criado após o consentimento.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = routeToken ?? localStorage.getItem(STORAGE_KEY) ?? null;
      try {
        if (stored) {
          const l = await call({ action: "resume", resume_token: stored });
          if (cancelled) return;
          localStorage.setItem(STORAGE_KEY, l.resume_token);
          hydrate(l);
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeToken]);

  // Início efetivo do diagnóstico — exige consentimento LGPD explícito (Fase 6b).
  const startWithConsent = async () => {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) utm[k] = v;
    }
    setStarting(true);
    try {
      const l = await call({
        action: "start",
        consent_lgpd: true,
        utm,
        referrer: document.referrer || null,
        landing_page: window.location.href,
      });
      localStorage.setItem(STORAGE_KEY, l.resume_token);
      hydrate(l);
    } catch (e) {
      toast.error(
        (e as Error).message === "rate_limited"
          ? "Muitas tentativas a partir desta conexão. Tente novamente mais tarde."
          : "Não foi possível iniciar o diagnóstico agora.",
      );
    } finally {
      setStarting(false);
    }
  };


  const persist = useCallback(
    async (nextStep = step) => {
      if (!lead || lead.status !== "em_andamento") return;
      setSaving(true);
      try {
        const l = await call({ action: "save", resume_token: lead.resume_token, answers, current_step: nextStep, ...contact });
        setLead(l);
        dirty.current = false;
      } catch {
        /* autosave silencioso: nova tentativa na próxima alteração */
      } finally {
        setSaving(false);
      }
    },
    [answers, call, contact, lead, step],
  );

  // Autosave com debounce a cada alteração de resposta ou contato.
  useEffect(() => {
    if (!lead || lead.status !== "em_andamento" || !dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, contact]);

  const setAnswer = (id: string, value: number) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };
  const setField = (key: keyof typeof contact, value: string) => {
    dirty.current = true;
    setContact((prev) => ({ ...prev, [key]: value }));
  };

  const stepQuestions = useMemo(() => {
    const current = STEPS[step];
    if (!current || current.key === "contexto") return [];
    if (current.key === "idd") return QUESTIONS.filter((q) => q.section === "idd");
    return QUESTIONS.filter((q) => q.pillar === current.key);
  }, [step]);

  const total = BLINDSPOTS.length + IDD_DIMENSIONS.length;
  const answered = QUESTIONS.filter((q) => typeof answers[q.id] === "number").length;
  const progress = Math.round((answered / total) * 100);

  const contextValid = contact.full_name.trim() && /\S+@\S+\.\S+/.test(contact.email) && contact.company_name.trim();
  const stepComplete =
    STEPS[step]?.key === "contexto" ? Boolean(contextValid) : stepQuestions.every((q) => typeof answers[q.id] === "number");

  const goNext = async () => {
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
      await persist(next);
      return;
    }
    if (!lead) return;
    setFinishing(true);
    try {
      const l = await call({ action: "finish", resume_token: lead.resume_token, answers, current_step: step, ...contact });
      setLead(l);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const reason = (e as Error).message;
      toast.error(reason === "incomplete" ? "Responda todas as afirmações antes de concluir." : "Não foi possível concluir agora.");
    } finally {
      setFinishing(false);
    }
  };

  const restart = () => {
    localStorage.removeItem(STORAGE_KEY);
    if (routeToken) navigate("/diagnostico-lead");
    else window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  const done = lead?.status !== "em_andamento" && lead?.result;

  return (
    <div className="min-h-screen bg-gradient-surface px-4 py-10">
      <header className="w-full max-w-3xl mx-auto flex items-center justify-between">
        <Logo />
        <Link to="/auth" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          Acessar plataforma
        </Link>
      </header>

      <main className="w-full max-w-3xl mx-auto mt-10 space-y-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Diagnóstico SEE_4X</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">
            {done ? "Sua leitura SEE_4X" : "Descubra onde sua empresa ainda improvisa"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {done
              ? "Resultado indicativo com os pontos cegos prioritários e o caminho recomendado — sem compromisso."
              : "20 BlindSpots e 8 dimensões de dependência do dono. Leva cerca de 8 minutos e você pode retomar depois."}
          </p>
        </div>

        {done && lead?.result ? (
          <>
            <Card className="p-8 shadow-elegant bg-gradient-brand text-primary-foreground relative overflow-hidden">
              <div className="absolute -top-16 -right-16 h-48 w-48 bg-gold/15 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-gold text-xs font-bold tracking-widest uppercase">
                  <CheckCircle2 className="h-4 w-4" /> Diagnóstico concluído
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-5xl font-black">{lead.result.improvisoGeral}</p>
                    <p className="text-xs text-primary-foreground/70 mt-1">Improviso geral (0–100)</p>
                  </div>
                  <div>
                    <p className="text-3xl font-black">{lead.result.idd.score}</p>
                    <p className="text-xs text-primary-foreground/70 mt-1">IDD · Dependência do dono</p>
                  </div>
                  <Badge className={improvisoBand(lead.result.improvisoGeral).color}>{lead.result.band.label}</Badge>
                </div>
                <p className="mt-5 text-xs text-primary-foreground/70">{lead.result.disclaimer}</p>
              </div>
            </Card>

            <Card className="p-6 shadow-card">
              <h2 className="font-black text-lg">Improviso por pilar</h2>
              <div className="mt-4 space-y-4">
                {lead.result.byPillar.map((p) => (
                  <div key={p.pillar}>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>{p.label ?? PILLAR_LABEL[p.pillar]}</span>
                      <span>{p.improviso}</span>
                    </div>
                    <Progress value={p.improviso} className="mt-2 h-2" />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 shadow-card">
              <h2 className="font-black text-lg">Top 5 BlindSpots prioritários</h2>
              <ol className="mt-4 space-y-3">
                {lead.result.blindspots.slice(0, 5).map((b, i) => (
                  <li key={b.code} className="flex items-start gap-3">
                    <span className="h-6 w-6 rounded-full bg-gold/15 text-gold text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{b.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {b.code} · Improviso {b.improviso}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            {lead.recommendation && (
              <Card className="p-6 shadow-card border-gold/40">
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-gold uppercase">
                  <Sparkles className="h-3.5 w-3.5" /> Caminho recomendado
                </div>
                <h2 className="font-black text-xl mt-2">{lead.recommendation.track}</h2>
                <p className="mt-2 font-semibold">{lead.recommendation.headline}</p>
                <p className="mt-2 text-sm text-muted-foreground">{lead.recommendation.why}</p>
                <ul className="mt-4 space-y-2">
                  {lead.recommendation.next_steps.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs text-muted-foreground">
                  Nenhuma matrícula é feita automaticamente: um Consultor 4X valida esta leitura antes de qualquer início de jornada.
                </p>
              </Card>
            )}

            <Card className="p-6 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Guarde o link do seu resultado</p>
                <p className="text-xs text-muted-foreground font-mono break-all mt-1">
                  {window.location.origin}/diagnostico-lead/{lead.resume_token}
                </p>
              </div>
              <Button variant="outline" onClick={restart}>
                Fazer novo diagnóstico
              </Button>
            </Card>
          </>
        ) : (
          <>
            <Card className="p-5 shadow-card">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>
                  Etapa {step + 1} de {STEPS.length} · {answered}/{total} respondidas
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                  {saving ? "Salvando..." : "Progresso salvo automaticamente"}
                </span>
              </div>
              <Progress value={progress} className="mt-3 h-2" />
            </Card>

            <Card className="p-6 md:p-8 shadow-card">
              <h2 className="font-black text-xl">{STEPS[step]?.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{STEPS[step]?.subtitle}</p>

              {STEPS[step]?.key === "contexto" ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Seu nome *</Label>
                    <Input id="full_name" value={contact.full_name} onChange={(e) => setField("full_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input id="email" type="email" value={contact.email} onChange={(e) => setField("email", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">WhatsApp</Label>
                    <Input id="phone" value={contact.phone} onChange={(e) => setField("phone", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company_name">Empresa *</Label>
                    <Input id="company_name" value={contact.company_name} onChange={(e) => setField("company_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="segment">Segmento</Label>
                    <Input id="segment" value={contact.segment} onChange={(e) => setField("segment", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role_title">Seu papel</Label>
                    <Input id="role_title" value={contact.role_title} onChange={(e) => setField("role_title", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="revenue_band">Faturamento anual</Label>
                    <Input
                      id="revenue_band"
                      placeholder="Ex.: R$ 3 a 10 milhões"
                      value={contact.revenue_band}
                      onChange={(e) => setField("revenue_band", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="team_size">Tamanho do time</Label>
                    <Input
                      id="team_size"
                      placeholder="Ex.: 25 pessoas"
                      value={contact.team_size}
                      onChange={(e) => setField("team_size", e.target.value)}
                    />
                  </div>
                  <p className="sm:col-span-2 text-xs text-muted-foreground flex items-start gap-2">
                    <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Usamos seus dados apenas para enviar o resultado e falar sobre a leitura. Nada é publicado.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {stepQuestions.map((q) => (
                    <div key={q.id} className="pb-5 border-b border-border last:border-0 last:pb-0">
                      <p className="font-semibold text-sm">{q.statement}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{q.id} · {q.label}</p>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {ANSWER_SCALE.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setAnswer(q.id, s.value)}
                            aria-pressed={answers[q.id] === s.value}
                            className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors ${
                              answers[q.id] === s.value
                                ? "border-gold bg-gold/15 text-gold"
                                : "border-border hover:border-gold/50 text-muted-foreground"
                            }`}
                          >
                            <span className="block text-base font-black">{s.value}</span>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button onClick={goNext} disabled={!stepComplete || finishing} className="bg-gradient-brand">
                  {finishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {step === STEPS.length - 1 ? "Ver minha leitura" : "Continuar"}
                  {!finishing && step < STEPS.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </Card>

            {lead && (
              <p className="text-xs text-muted-foreground text-center">
                Precisa parar agora? Seu progresso fica salvo — retome por{" "}
                <span className="font-mono break-all">/diagnostico-lead/{lead.resume_token}</span>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
