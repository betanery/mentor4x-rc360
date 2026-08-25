import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IMPROVISO_LABEL, CYCLE_LABEL, MEETING_TYPE_LABEL, formatBRL } from "@/lib/labels";
import { Building2, AlertTriangle, TrendingDown, Plus, CalendarDays, ShieldCheck, Video, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MentorArea() {
  const { setCurrentId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["mentor-area"],
    queryFn: async () => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 21);
      const [companies, goals, meetings, cycles, diagnostics] = await Promise.all([
        supabase.from("companies").select("*").order("name"),
        supabase.from("goals").select("id, company_id, title, status, due_date, approval_status, is_critical, capacity_justification"),
        supabase
          .from("meetings")
          .select("id, company_id, title, meeting_type, scheduled_at, meeting_url")
          .gte("scheduled_at", new Date().toISOString())
          .lte("scheduled_at", horizon.toISOString())
          .order("scheduled_at"),
        supabase.from("cycle_records").select("id, company_id, cycle, started_at, closed_at").is("closed_at", null),
        supabase.from("diagnostics").select("id, company_id, status, title, created_at").eq("status", "consolidado"),
      ]);
      return {
        companies: companies.data || [],
        goals: goals.data || [],
        meetings: meetings.data || [],
        openCycles: cycles.data || [],
        pendingDiagnostics: diagnostics.data || [],
      };
    },
  });

  const companies = data?.companies || [];
  const companyName = useMemo(
    () => Object.fromEntries(companies.map((c: any) => [c.id, c.name])),
    [companies],
  );

  const lateByCompany: Record<string, number> = {};
  (data?.goals || []).forEach((g: any) => {
    if (g.status === "atrasado") lateByCompany[g.company_id] = (lateByCompany[g.company_id] || 0) + 1;
  });
  const pendingApprovals = (data?.goals || []).filter((g: any) => g.approval_status === "pendente");
  const atRisk = companies.filter((c: any) => ["total", "severo"].includes(c.chaos_level));
  const avgScore = companies.length
    ? Math.round(companies.reduce((s: number, c: any) => s + c.overall_score, 0) / companies.length)
    : 0;

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
      <PageHeader
        title="Área do Consultor 4X"
        subtitle="Agenda consolidada, decisões pendentes e carteira de Clientes 4X."
        action={
          <Link to="/empresas">
            <Button className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> Cadastrar empresa</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-royal" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Clientes ativos</span></div>
          <div className="mt-2 text-4xl font-black">{companies.length}</div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Em risco</span></div>
          <div className="mt-2 text-4xl font-black text-destructive">{atRisk.length}</div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-gold" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decisões pendentes</span></div>
          <div className="mt-2 text-4xl font-black text-gold">{pendingApprovals.length + (data?.pendingDiagnostics.length || 0)}</div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><TrendingDown className="h-5 w-5 text-warning" /><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Score médio</span></div>
          <div className="mt-2 text-4xl font-black">{avgScore}</div>
        </Card>
      </div>

      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="decisoes">Decisões</TabsTrigger>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-3">
          <Card className="p-6 shadow-card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-royal" /> Próximas sessões (21 dias)</h3>
            {(data?.meetings.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão agendada no período. Agende na Sala de Guerra do Cliente 4X.</p>
            ) : (
              <div className="space-y-2">
                {data!.meetings.map((m: any) => (
                  <div key={m.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="md:w-40 text-sm font-bold">
                      {format(new Date(m.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.title}</div>
                      <p className="text-xs text-muted-foreground">
                        {companyName[m.company_id] ?? "—"} · {MEETING_TYPE_LABEL[m.meeting_type] ?? m.meeting_type}
                      </p>
                    </div>
                    {m.meeting_url && (
                      <a href={m.meeting_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline"><Video className="h-4 w-4 mr-1" /> Entrar</Button>
                      </a>
                    )}
                    <Link to="/sala-guerra" onClick={() => setCurrentId(m.company_id)}>
                      <Button size="sm" variant="ghost">Abrir empresa</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 shadow-card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><RefreshCcw className="h-5 w-5 text-royal" /> Ciclos em andamento</h3>
            {(data?.openCycles.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ciclo aberto. Abra o ciclo atual na Jornada de cada Cliente 4X.</p>
            ) : (
              <div className="space-y-2">
                {data!.openCycles.map((c: any) => (
                  <Link key={c.id} to="/jornada" onClick={() => setCurrentId(c.company_id)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold transition-colors">
                    <Badge variant="outline">{CYCLE_LABEL[c.cycle]?.label ?? c.cycle}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{companyName[c.company_id] ?? "—"}</div>
                      <p className="text-xs text-muted-foreground">
                        {CYCLE_LABEL[c.cycle]?.subtitle} · aberto em {format(new Date(c.started_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="decisoes" className="space-y-3">
          <Card className="p-6 shadow-card">
            <h3 className="text-lg font-bold mb-4">Metas aguardando aprovação</h3>
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta aguardando aprovação do Consultor 4X.</p>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.map((g: any) => (
                  <Link key={g.id} to="/metas" onClick={() => setCurrentId(g.company_id)}
                    className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border border-border hover:border-gold transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{g.title}</div>
                      <p className="text-xs text-muted-foreground">{companyName[g.company_id] ?? "—"}</p>
                    </div>
                    {g.is_critical && <Badge className="bg-gold text-primary-foreground">Meta Crítica</Badge>}
                    {g.due_date && (
                      <Badge variant={isBefore(new Date(g.due_date), new Date()) ? "destructive" : "outline"}>
                        {format(new Date(g.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 shadow-card">
            <h3 className="text-lg font-bold mb-4">Diagnósticos aguardando validação</h3>
            {(data?.pendingDiagnostics.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum diagnóstico consolidado pendente de validação.</p>
            ) : (
              <div className="space-y-2">
                {data!.pendingDiagnostics.map((d: any) => (
                  <Link key={d.id} to="/diagnostico" onClick={() => setCurrentId(d.company_id)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{d.title || "Diagnóstico SEE_4X"}</div>
                      <p className="text-xs text-muted-foreground">{companyName[d.company_id] ?? "—"}</p>
                    </div>
                    <Badge variant="outline">Consolidado</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="carteira">
          <Card className="p-6 shadow-card">
            <h3 className="text-lg font-bold mb-4">Carteira de clientes</h3>
            <div className="space-y-2">
              {companies.map((c: any) => {
                const improviso = IMPROVISO_LABEL[c.chaos_level];
                const stage = CYCLE_LABEL[c.journey_stage];
                const lateGoals = lateByCompany[c.id] || 0;
                return (
                  <Link key={c.id} to="/" onClick={() => setCurrentId(c.id)}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border border-border hover:border-gold hover:shadow-card transition-all">
                    <div className="h-12 w-12 rounded-xl bg-gradient-brand text-primary-foreground font-black flex items-center justify-center shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold">{c.name}</h4>
                        <Badge className={improviso?.color} variant="secondary">{improviso?.label}</Badge>
                        <Badge variant="outline">{stage?.label} · {stage?.subtitle}</Badge>
                        {lateGoals > 0 && <Badge variant="destructive">{lateGoals} metas atrasadas</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{c.segment} · Receita projetada {formatBRL(c.projected_revenue)}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</div><div className="font-black text-xl">{c.overall_score}</div></div>
                      <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Dependência</div><div className="font-black text-xl text-warning">{c.owner_dependency}%</div></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
