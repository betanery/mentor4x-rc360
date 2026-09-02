import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IMPROVISO_LABEL, CYCLE_LABEL, formatBRL } from "@/lib/labels";
import { Copy, MessageSquare, Target, AlertTriangle, ListChecks, Gauge } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const TEMPLATES = [
  { title: "Cobrança gentil de meta atrasada", text: "Oi! Vi aqui no painel que a meta '{{meta}}' está marcada como atrasada. Bora destravar? Me conta o que está pegando — agendo um call rápido se ajudar." },
  { title: "Convite para Sala de Guerra", text: "Confirmando nossa Sala de Guerra desta quinzena. Por favor já preencha os 5 blocos no painel: feito / travou / indicadores / próximos passos / decisões." },
  { title: "Parabéns por meta concluída", text: "Excelente! Vi que você bateu a meta '{{meta}}'. Esse é exatamente o tipo de execução que estrutura a empresa. Bora pra próxima!" },
  { title: "Cliente sem acesso há 7 dias", text: "Ei, tudo certo? Notei que você não acessou o sistema há alguns dias. O que está pegando aí? Estou à disposição." },
];

export default function StrategistArea() {
  const { setCurrentId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["strategist-area"],
    queryFn: async () => {
      const [companies, goals, tasks, bottlenecks, leads] = await Promise.all([
        supabase.from("companies").select("*").order("name"),
        supabase.from("goals").select("id, company_id, title, status, due_date, financial_impact"),
        supabase.from("tasks").select("id, company_id, title, description, due_date").eq("done", false).order("due_date", { nullsFirst: false }),
        supabase.from("bottlenecks").select("id, company_id, name, urgency, resolved").eq("resolved", false),
        supabase
          .from("lead_diagnostics")
          .select("id, full_name, email, company_name, status, improviso_score, idd_score, priority_pillar, recommendation, utm_source, utm_campaign, current_step, created_at, completed_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return {
        companies: companies.data || [],
        goals: goals.data || [],
        tasks: tasks.data || [],
        bottlenecks: bottlenecks.data || [],
        leads: leads.data || [],
      };
    },
  });

  const companies = data?.companies || [];
  const companyName = useMemo(() => Object.fromEntries(companies.map((c: any) => [c.id, c.name])), [companies]);

  const goals = data?.goals || [];
  const lateGoals = goals.filter((g: any) => g.status === "atrasado");
  const blockedGoals = goals.filter((g: any) => g.status === "bloqueado");
  const criticalBottlenecks = (data?.bottlenecks || []).filter((b: any) => ["alta", "critica"].includes(b.urgency));
  const overdueTasks = (data?.tasks || []).filter((t: any) => t.due_date && isBefore(new Date(t.due_date), new Date()));
  const avgScore = companies.length
    ? Math.round(companies.reduce((s: number, c: any) => s + c.overall_score, 0) / companies.length)
    : 0;

  const byCompany = (id: string) => ({
    late: goals.filter((g: any) => g.company_id === id && g.status === "atrasado").length,
    open: (data?.tasks || []).filter((t: any) => t.company_id === id).length,
    bottlenecks: (data?.bottlenecks || []).filter((b: any) => b.company_id === id).length,
  });

  const copyTpl = (t: string) => { navigator.clipboard.writeText(t); toast.success("Mensagem copiada"); };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Área do Estrategista 4X" subtitle="KPIs da carteira, follow-up de execução e biblioteca de mensagens." />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><Target className="h-5 w-5 text-destructive" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Metas atrasadas</span></div>
          <div className="mt-2 text-4xl font-black text-destructive">{lateGoals.length}</div>
          <p className="text-xs text-muted-foreground mt-1">{blockedGoals.length} bloqueadas</p>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-warning" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gargalos alta/crítica</span></div>
          <div className="mt-2 text-4xl font-black text-warning">{criticalBottlenecks.length}</div>
          <p className="text-xs text-muted-foreground mt-1">{data?.bottlenecks.length || 0} gargalos abertos</p>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><ListChecks className="h-5 w-5 text-royal" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ações em atraso</span></div>
          <div className="mt-2 text-4xl font-black">{overdueTasks.length}</div>
          <p className="text-xs text-muted-foreground mt-1">{data?.tasks.length || 0} ações abertas</p>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-gold" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Score médio</span></div>
          <div className="mt-2 text-4xl font-black">{avgScore}</div>
          <p className="text-xs text-muted-foreground mt-1">{companies.length} empresas na carteira</p>
        </Card>
      </div>

      <Tabs defaultValue="carteira">
        <TabsList>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
          <TabsTrigger value="risco">Metas em risco</TabsTrigger>
          <TabsTrigger value="tarefas">Ações abertas</TabsTrigger>
          <TabsTrigger value="leads">Leads do diagnóstico</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens prontas</TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="space-y-2">
          {companies.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhuma empresa na carteira.</Card>}
          {companies.map((c: any) => {
            const improviso = IMPROVISO_LABEL[c.chaos_level];
            const stage = CYCLE_LABEL[c.journey_stage];
            const m = byCompany(c.id);
            return (
              <Link key={c.id} to="/" onClick={() => setCurrentId(c.id)}
                className="block p-4 rounded-lg border border-border hover:border-gold hover:shadow-card transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-royal text-primary-foreground font-bold flex items-center justify-center shrink-0">{c.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{c.name}</h4>
                      <Badge className={improviso?.color} variant="secondary">{improviso?.label}</Badge>
                      <Badge variant="outline">{stage?.label}</Badge>
                      {m.late > 0 && <Badge variant="destructive">{m.late} atrasadas</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Score {c.overall_score} · {formatBRL(c.projected_revenue)} · {m.open} ações abertas · {m.bottlenecks} gargalos
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </TabsContent>

        <TabsContent value="risco" className="space-y-2">
          {lateGoals.length + blockedGoals.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">Nenhuma meta atrasada ou bloqueada na carteira.</Card>
          )}
          {[...lateGoals, ...blockedGoals].map((g: any) => (
            <Link key={g.id} to="/metas" onClick={() => setCurrentId(g.company_id)}
              className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border border-border hover:border-gold transition-colors">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{g.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {companyName[g.company_id] ?? "—"}
                  {g.financial_impact ? ` · impacto ${formatBRL(g.financial_impact)}` : ""}
                </p>
              </div>
              <Badge variant={g.status === "atrasado" ? "destructive" : "secondary"}>
                {g.status === "atrasado" ? "Atrasada" : "Bloqueada"}
              </Badge>
              {g.due_date && <Badge variant="outline">{format(new Date(g.due_date), "dd/MM/yyyy", { locale: ptBR })}</Badge>}
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="tarefas" className="space-y-2">
          {(data?.tasks.length || 0) === 0 && <Card className="p-8 text-center text-muted-foreground">Sem ações abertas.</Card>}
          {data!.tasks.map((t: any) => {
            const overdue = t.due_date && isBefore(new Date(t.due_date), new Date());
            return (
              <Link key={t.id} to="/plano-acao" onClick={() => setCurrentId(t.company_id)}
                className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border border-border hover:border-gold transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{t.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {companyName[t.company_id] ?? "—"}{t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                {t.due_date && (
                  <Badge variant={overdue ? "destructive" : "outline"}>
                    {format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR })}
                  </Badge>
                )}
              </Link>
            );
          })}
        </TabsContent>

        <TabsContent value="leads">
          <LeadCapture leads={(data?.leads || []) as any} />
        </TabsContent>


        <TabsContent value="mensagens" className="space-y-3">
          {TEMPLATES.map((tpl, i) => (
            <Card key={i} className="p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-royal" /> {tpl.title}</h4>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{tpl.text}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyTpl(tpl.text)}><Copy className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
