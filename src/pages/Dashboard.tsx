import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { StatCard } from "@/components/StatCard";
import { IMPROVISO_LABEL, CYCLE_LABEL, CYCLE_ORDER, GOAL_STATUS_LABEL, PILLAR_LABEL, formatBRL } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Target, AlertTriangle, TrendingUp, Calendar, DollarSign, Users, Sparkles } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { MATURITY_LABEL, blindspotByCode, improvisoBand, type MaturityLevel } from "@/lib/see4x";

export default function Dashboard() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const [goals, setGoals] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [pillars, setPillars] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [diagnostic, setDiagnostic] = useState<any | null>(null);

  useEffect(() => {
    if (!current) return;
    (async () => {
      const goalsQuery = supabase.from("goals").select("*").eq("company_id", current.id).order("due_date", { ascending: true });
      const bottlenecksQuery = supabase.from("bottlenecks").select("*").eq("company_id", current.id).eq("resolved", false).order("urgency", { ascending: false }).limit(5);
      const pillarsQuery = supabase.from("pillar_scores").select("*").eq("company_id", current.id).order("measured_at", { ascending: false });
      const meetingsQuery = supabase.from("meetings").select("*").eq("company_id", current.id).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1);
      const diagnosticQuery = supabase.from("diagnostics").select("*").eq("company_id", current.id).eq("status", "validado").order("version", { ascending: false }).limit(1);
      if (currentContract) {
        goalsQuery.eq("contract_id", currentContract.id);
        bottlenecksQuery.eq("contract_id", currentContract.id);
        pillarsQuery.eq("contract_id", currentContract.id);
        meetingsQuery.eq("contract_id", currentContract.id);
        diagnosticQuery.eq("contract_id", currentContract.id);
      } else {
        goalsQuery.is("contract_id", null);
        bottlenecksQuery.is("contract_id", null);
        pillarsQuery.is("contract_id", null);
        meetingsQuery.is("contract_id", null);
        diagnosticQuery.is("contract_id", null);
      }
      const [g, b, p, m, d] = await Promise.all([goalsQuery, bottlenecksQuery, pillarsQuery, meetingsQuery, diagnosticQuery]);
      setGoals(g.data || []);
      setBottlenecks(b.data || []);
      setPillars(p.data || []);
      setMeetings(m.data || []);
      setDiagnostic((d.data || [])[0] || null);

      // Real 90-day score evolution: average of pillar scores grouped per week (last 12 weeks)
      const scores = (p.data || []) as Array<{ measured_at: string; score: number }>;
      const buckets = new Map<string, { sum: number; n: number }>();
      const weekKey = (d: Date) => {
        const start = subDays(d, d.getDay()); // sunday-start
        return format(start, "yyyy-MM-dd");
      };
      scores.forEach((s) => {
        const d = parseISO(s.measured_at);
        const k = weekKey(d);
        const cur = buckets.get(k) || { sum: 0, n: 0 };
        cur.sum += s.score; cur.n += 1;
        buckets.set(k, cur);
      });
      const history = Array.from({ length: 12 }, (_, i) => {
        const d = subDays(new Date(), (11 - i) * 7);
        const k = weekKey(d);
        const v = buckets.get(k);
        return {
          date: format(d, "dd/MM", { locale: ptBR }),
          score: v ? Math.round(v.sum / v.n) : null,
        };
      });
      // Forward-fill nulls with last known score; if none, use overall_score
      let last = current.overall_score || 0;
      const filled = history.map((h) => {
        if (h.score == null) return { ...h, score: last };
        last = h.score;
        return h;
      });
      setScoreHistory(filled);
    })();
  }, [current, currentContract]);

  if (!current) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
        <Sparkles className="h-12 w-12 text-gold mx-auto" />
        <h2 className="text-2xl font-bold">Bem-vindo ao Mentor 4X</h2>
        <p className="text-muted-foreground">
          Você ainda não está vinculado a uma empresa. Peça ao seu Consultor 4X um convite, ou — se você é staff —
          crie uma nova empresa para começar a operação.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/empresas" className="text-sm font-semibold text-primary underline">Ir para Empresas</Link>
          <Link to="/notificacoes" className="text-sm font-semibold text-royal underline">Ver notificações</Link>
        </div>
      </div>
    );
  }

  const improviso = IMPROVISO_LABEL[current.chaos_level];
  const stageKey = currentContract?.journey_stage ?? current.journey_stage;
  const stage = CYCLE_LABEL[stageKey];

  const weeklyGoals = goals.filter((g) => {
    if (!g.week_start) return false;
    const ws = new Date(g.week_start);
    const now = new Date();
    const diff = (now.getTime() - ws.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7;
  });
  const completedWeekly = weeklyGoals.filter((g) => g.status === "concluido").length;
  const execRate = weeklyGoals.length ? Math.round((completedWeekly / weeklyGoals.length) * 100) : 0;

  // Latest pillar score per pillar
  const latestPillar = (key: string) => {
    const arr = pillars.filter((p) => p.pillar === key);
    return arr[0]?.score ?? 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dashboard Executivo`}
        subtitle="Visão completa da execução, score e próximos passos da empresa."
        action={<Badge className={`${improviso.color} text-xs px-3 py-1.5 font-bold`}>{improviso.label}</Badge>}
      />

      <OnboardingChecklist companyId={current.id} contractId={currentContract?.id} />


      {/* Bloco Classificação — baseline oficial do Diagnóstico SEE_4X */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">Classificação</p>
            <p className="text-xs text-muted-foreground">
              {diagnostic
                ? `Diagnóstico v${diagnostic.version} validado em ${new Date(diagnostic.validated_at).toLocaleDateString("pt-BR")}`
                : "Nenhum diagnóstico validado — a classificação abaixo ainda não tem baseline oficial."}
            </p>
          </div>
          <Link to="/diagnostico" className="text-sm font-semibold text-primary underline">
            {diagnostic ? "Ver diagnóstico →" : "Fazer diagnóstico →"}
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">Maturidade</p>
            {diagnostic?.maturity ? (
              <Badge className={MATURITY_LABEL[diagnostic.maturity as MaturityLevel].color}>
                {MATURITY_LABEL[diagnostic.maturity as MaturityLevel].label}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Não validada</span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">Improviso geral</p>
            {diagnostic?.improviso_score != null ? (
              <div className="flex items-center gap-2">
                <span className="text-xl font-black">{diagnostic.improviso_score}</span>
                <Badge className={improvisoBand(diagnostic.improviso_score).color}>{improvisoBand(diagnostic.improviso_score).label}</Badge>
              </div>
            ) : (
              <Badge className={improviso.color}>{improviso.label}</Badge>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">Pilar prioritário</p>
            <span className="text-sm font-semibold">
              {diagnostic?.priority_pillar ? PILLAR_LABEL[diagnostic.priority_pillar].label : "—"}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">BlindSpot prioritário</p>
            <span className="text-sm font-semibold">
              {diagnostic?.priority_blindspot ? blindspotByCode(diagnostic.priority_blindspot)?.title ?? diagnostic.priority_blindspot : "—"}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">IDD</p>
            <span className="text-xl font-black">{diagnostic?.idd_score != null ? `${diagnostic.idd_score}%` : `${current.owner_dependency}%`}</span>
          </div>
        </div>
      </Card>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Score Geral" value={current.overall_score} sub="0–100 pontos" icon={Activity} accent="primary" />
        <StatCard label="Índice de Execução" value={`${execRate}%`} sub={`${completedWeekly}/${weeklyGoals.length} metas`} icon={Target} accent="gold" />
        <StatCard label="Dependência do dono" value={`${current.owner_dependency}%`} sub="meta < 30%" icon={Users} accent={current.owner_dependency > 60 ? "destructive" : "info"} />
        <StatCard label="Receita projetada" value={formatBRL(current.projected_revenue)} sub="próximos 12 meses" icon={DollarSign} accent="success" />
      </div>

      {/* Stage + Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6 shadow-card overflow-hidden relative bg-gradient-brand text-primary-foreground">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Ciclo atual da Jornada SEE_4X</p>
            <div className="mt-2 flex items-baseline gap-3">
              <h2 className="text-4xl font-black">{stage.label}</h2>
              <span className="text-gold font-semibold">{stage.subtitle}</span>
            </div>
            <div className="mt-6 flex items-center gap-2">
              {CYCLE_ORDER.slice(0, 6).map((s, i) => {
                const active = CYCLE_ORDER.indexOf(stageKey as typeof CYCLE_ORDER[number]) >= i;
                return <div key={s} className={`h-2 flex-1 rounded-full ${active ? "bg-gold" : "bg-primary-foreground/20"}`} />;
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-card">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Próximo ritual</p>
          {meetings[0] ? (
            <div className="mt-2">
              <div className="text-lg font-bold">{meetings[0].title}</div>
              <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(parseISO(meetings[0].scheduled_at), "dd 'de' MMMM 'às' HH'h'mm", { locale: ptBR })}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum ritual agendado.</p>
          )}
        </Card>
      </div>

      {/* Pilares 4X */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold">Pilares 4X</h3>
            <p className="text-sm text-muted-foreground">Score atual em cada eixo do método</p>
          </div>
          <Link to="/pilares" className="text-xs font-semibold text-royal hover:text-primary">Ver detalhes →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PILLAR_LABEL).map(([key, p]) => {
            const score = latestPillar(key);
            return (
              <div key={key} className={`p-4 rounded-xl bg-gradient-to-br ${p.color} text-white relative overflow-hidden`}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{p.label}</p>
                <div className="text-4xl font-black mt-2">{score}</div>
                <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${score}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Charts + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">Evolução do Score · 90 dias</h3>
              <p className="text-sm text-muted-foreground">Trajetória da empresa nas últimas 12 semanas</p>
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={scoreHistory}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--royal))" strokeWidth={3} dot={{ fill: "hsl(var(--gold))", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Metas Críticas do ciclo</h3>
            <Link to="/metas" className="text-xs font-semibold text-royal hover:text-primary">Ver todas →</Link>
          </div>
          {weeklyGoals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma Meta Crítica definida para este ciclo.</p>}
          <div className="space-y-3">
            {weeklyGoals.slice(0, 4).map((g) => {
              const st = GOAL_STATUS_LABEL[g.status];
              return (
                <div key={g.id} className="border border-border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold line-clamp-2 flex-1">{g.title}</p>
                    <Badge className={`${st.color} text-[10px] shrink-0`} variant="secondary">{st.label}</Badge>
                  </div>
                  {g.financial_impact > 0 && <p className="text-xs text-success font-semibold mt-1">{formatBRL(g.financial_impact)}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Bottlenecks */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Top gargalos críticos</h3>
            <p className="text-sm text-muted-foreground">Travas que mais impactam o resultado agora</p>
          </div>
          <Link to="/gargalos" className="text-xs font-semibold text-royal hover:text-primary">Ver todos →</Link>
        </div>
        {bottlenecks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum gargalo crítico identificado.</p>}
        <div className="space-y-3">
          {bottlenecks.map((b) => (
            <div key={b.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:border-destructive/40 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.area} · {formatBRL(b.estimated_value)} em impacto</p>
              </div>
              <div className="w-32 hidden md:block">
                <Progress value={b.progress} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.progress}% resolvido</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
