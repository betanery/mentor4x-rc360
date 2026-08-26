import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Download,
  Plus,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Target,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { MOTORES, PILLAR_LABEL } from "@/lib/labels";
import { MATURITY_LABEL, improvisoBand } from "@/lib/see4x";
import { structuringScore, executionIndex, economicImpact, formatBRL } from "@/lib/metrics";
import { Progress } from "@/components/ui/progress";


const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-warning/15 text-warning" },
  consolidado: { label: "Consolidado", color: "bg-info/15 text-info" },
  validado: { label: "Validado", color: "bg-success/15 text-success" },
};

const GOAL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  nao_iniciado: { label: "Não iniciado", color: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", color: "bg-info/15 text-info" },
  concluido: { label: "Concluído", color: "bg-success/15 text-success" },
  atrasado: { label: "Atrasado", color: "bg-destructive/15 text-destructive" },
  bloqueado: { label: "Bloqueado", color: "bg-warning/15 text-warning" },
};

function motorForPillar(pillar: string): string {
  switch (pillar) {
    case "crescimento":
      return "prioridade";
    case "lideranca":
      return "governanca";
    case "eficiencia":
    case "encantamento":
    default:
      return "execucao";
  }
}

export default function ReportSee4X() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const qc = useQueryClient();
  const [baselineId, setBaselineId] = useState<string>("");
  const [followUpId, setFollowUpId] = useState<string>("");

  const { data: diagnostics = [], isLoading: loadingDiags } = useQuery({
    queryKey: ["diagnostics", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("diagnostics")
        .select("*")
        .eq("company_id", current!.id)
        .order("version", { ascending: false });
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["reports", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("reports")
        .select("*")
        .eq("company_id", current!.id)
        .ilike("title", "Relatório SEE_4X%")
        .order("created_at", { ascending: false });
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["report_goals", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("goals")
        .select("*")
        .eq("company_id", current!.id)
        .in("status", ["nao_iniciado", "em_andamento", "atrasado", "bloqueado"])
        .eq("approval_status", "aprovada");
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fase 6a — base de mensuração: todas as metas aprovadas (inclui concluídas).
  const { data: allGoals = [] } = useQuery({
    queryKey: ["metric_goals", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("goals")
        .select("status,due_date,evidence_url,validated_at,financial_impact,is_critical,updated_at")
        .eq("company_id", current!.id)
        .eq("approval_status", "aprovada");
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });


  const baseline = diagnostics.find((d) => d.id === baselineId);
  const followUp = diagnostics.find((d) => d.id === followUpId);

  const baselineResult = baseline?.results as any;
  const followUpResult = followUp?.results as any;

  const radarData =
    baselineResult && followUpResult
      ? ["crescimento", "eficiencia", "encantamento", "lideranca"].map((p) => ({
          pillar: PILLAR_LABEL[p].label,
          baseline: baselineResult.byPillar?.find((x: any) => x.pillar === p)?.improviso ?? 0,
          followup: followUpResult.byPillar?.find((x: any) => x.pillar === p)?.improviso ?? 0,
        }))
      : [];

  const blindspotDeltas =
    baselineResult && followUpResult
      ? baselineResult.blindspots
          .map((b: any) => {
            const after = followUpResult.blindspots?.find((x: any) => x.code === b.code);
            return { ...b, delta: (after?.improviso ?? b.improviso) - b.improviso };
          })
          .sort((a: any, b: any) => a.delta - b.delta)
      : [];

  const topImprovements = blindspotDeltas.slice(0, 5).filter((b: any) => b.delta < 0);
  const topRegressions = blindspotDeltas.slice().reverse().slice(0, 5).filter((b: any) => b.delta > 0);

  // Fase 6a — métricas de mensuração
  const cycle = currentContract?.current_cycle ?? 1;
  const structBaseline = baselineResult ? structuringScore(baselineResult.byPillar ?? [], cycle) : null;
  const structFollowUp = followUpResult ? structuringScore(followUpResult.byPillar ?? [], cycle) : null;
  const execution = executionIndex(allGoals as any);
  const economic = economicImpact(allGoals as any);


  const generate = useMutation({
    mutationFn: async () => {
      if (!current || !baselineId || !followUpId) throw new Error("Selecione os dois diagnósticos");
      const { error } = await supabase.functions.invoke("ai-action", {
        body: {
          action: "generate-report",
          company_id: current.id,
          payload: { baseline_diagnostic_id: baselineId, follow_up_diagnostic_id: followUpId },
          contract_id: currentContract?.id,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório SEE_4X gerado em PDF");
      qc.invalidateQueries({ queryKey: ["reports", current?.id, currentContract?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const download = async (path: string, title: string) => {
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Não foi possível abrir o PDF");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = `${title}.pdf`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!current) {
    return (
      <div>
        <PageHeader
          title="Relatório SEE_4X"
          subtitle="Comparativo antes/depois e Plano de 90 dias com identidade RC360."
        />
        <Card className="p-10 text-center text-muted-foreground">Selecione uma empresa para começar.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório SEE_4X"
        subtitle="Comparativo antes/depois do diagnóstico e Plano de 90 dias, gerado em PDF com identidade RC360."
        action={
          <Button
            onClick={() => generate.mutate()}
            disabled={!baselineId || !followUpId || generate.isPending}
            className="bg-gradient-brand"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {generate.isPending ? "Gerando..." : "Gerar relatório em PDF"}
          </Button>
        }
      />

      <Card className="p-5 shadow-card">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold mb-4">Selecione os diagnósticos</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Diagnóstico baseline (antes)</label>
            <Select value={baselineId} onValueChange={setBaselineId} disabled={loadingDiags}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o diagnóstico baseline" />
              </SelectTrigger>
              <SelectContent>
                {diagnostics.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title || `v${d.version}`} · {" "}
                    {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })} · {STATUS_LABEL[d.status]?.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Diagnóstico follow-up (depois)</label>
            <Select value={followUpId} onValueChange={setFollowUpId} disabled={loadingDiags}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o diagnóstico follow-up" />
              </SelectTrigger>
              <SelectContent>
                {diagnostics.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title || `v${d.version}`} · {" "}
                    {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })} · {STATUS_LABEL[d.status]?.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {baselineResult && followUpResult && (
        <Tabs defaultValue="comparativo">
          <TabsList>
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores 4X</TabsTrigger>
            <TabsTrigger value="plano">Plano de 90 dias</TabsTrigger>
          </TabsList>

          <TabsContent value="indicadores" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-5 shadow-card">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Score de Estruturação 4X
                </p>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-3xl font-black">{structFollowUp?.score ?? "—"}</span>
                  <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                </div>
                {structFollowUp && (
                  <>
                    <Progress value={structFollowUp.score} className="mt-3" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Baseline: {structBaseline?.score ?? "—"} · pesos do ciclo {structFollowUp.cycle}
                    </p>
                  </>
                )}
              </Card>

              <Card className="p-5 shadow-card">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Índice de Execução
                </p>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-3xl font-black">{execution?.index ?? "—"}</span>
                  <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                </div>
                {execution && (
                  <>
                    <Progress value={execution.index} className="mt-3" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {execution.concluded} de {execution.total} metas aprovadas concluídas
                    </p>
                  </>
                )}
              </Card>

              <Card className="p-5 shadow-card">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Impacto Econômico realizado
                </p>
                <div className="text-3xl font-black mt-2">{formatBRL(economic.realizado)}</div>
                <Progress value={economic.conversao} className="mt-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  {economic.conversao}% do impacto declarado no plano ({formatBRL(economic.total)})
                </p>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5 shadow-card">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Composição do Índice de Execução
                </p>
                {!execution ? (
                  <p className="text-sm text-muted-foreground">Nenhuma meta aprovada para medir execução.</p>
                ) : (
                  <div className="space-y-3">
                    {execution.components.map((c) => (
                      <div key={c.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {c.label} <span className="text-muted-foreground text-xs">· peso {Math.round(c.weight * 100)}%</span>
                          </span>
                          <span className="font-semibold">{c.score}</span>
                        </div>
                        <Progress value={c.score} className="mt-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5 shadow-card">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Impacto Econômico por situação
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Realizado e validado", value: economic.realizado, color: "bg-success/15 text-success" },
                    { label: "Concluído aguardando validação", value: economic.aguardandoValidacao, color: "bg-info/15 text-info" },
                    { label: "Previsto em execução", value: economic.previsto, color: "bg-muted text-muted-foreground" },
                    { label: "Em risco (atrasado ou bloqueado)", value: economic.emRisco, color: "bg-destructive/15 text-destructive" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">{row.label}</span>
                      <Badge className={row.color}>{formatBRL(row.value)}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Valores declarados nas metas aprovadas. A validação do Consultor 4X é o que confirma o resultado.
                </p>
              </Card>
            </div>

            {structFollowUp && (
              <Card className="p-5 shadow-card">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Estruturação por pilar · pesos do ciclo {structFollowUp.cycle}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {structFollowUp.byPillar.map((p) => {
                    const before = structBaseline?.byPillar.find((x) => x.pillar === p.pillar)?.structuring;
                    return (
                      <div key={p.pillar}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {PILLAR_LABEL[p.pillar]?.label}{" "}
                            <span className="text-xs text-muted-foreground">· peso {Math.round(p.weight * 100)}%</span>
                          </span>
                          <span className="font-semibold">
                            {before !== undefined ? `${before} → ` : ""}
                            {p.structuring}
                          </span>
                        </div>
                        <Progress value={p.structuring} className="mt-1.5" />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </TabsContent>



          <TabsContent value="comparativo" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-5">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Improviso geral</p>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-3xl font-black">{followUpResult.improvisoGeral}</span>
                  <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                </div>
                <Badge className={`mt-2 ${improvisoBand(followUpResult.improvisoGeral).color}`}>
                  {improvisoBand(followUpResult.improvisoGeral).label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Baseline: {baselineResult.improvisoGeral}
                  {followUpResult.improvisoGeral - baselineResult.improvisoGeral <= 0 ? (
                    <span className="text-success ml-1 inline-flex items-center">
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                      {followUpResult.improvisoGeral - baselineResult.improvisoGeral}
                    </span>
                  ) : (
                    <span className="text-destructive ml-1 inline-flex items-center">
                      <TrendingUp className="h-3 w-3 mr-0.5" />+
                      {followUpResult.improvisoGeral - baselineResult.improvisoGeral}
                    </span>
                  )}
                </p>
              </Card>

              <Card className="p-5">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">IDD · Dependência do dono</p>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-3xl font-black">{followUpResult.idd?.score ?? followUpResult.iddScore ?? 0}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Baseline: {baselineResult.idd?.score ?? baselineResult.iddScore ?? 0}%
                </p>
              </Card>

              <Card className="p-5">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Maturidade follow-up</p>
                <Badge className={`mt-2 ${MATURITY_LABEL[(followUp.maturity as any) || "inicial"].color}`}>
                  {MATURITY_LABEL[(followUp.maturity as any) || "inicial"].label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Baseline: {MATURITY_LABEL[(baseline.maturity as any) || "inicial"].label}
                </p>
              </Card>

              <Card className="p-5">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Metas ativas aprovadas</p>
                <div className="text-3xl font-black mt-2">{goals.length}</div>
                <p className="text-xs text-muted-foreground mt-2">Base do Plano de 90 dias</p>
              </Card>
            </div>

            {radarData.length > 0 && (
              <Card className="p-6 shadow-card">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Radar de Improviso por pilar
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Baseline" dataKey="baseline" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} />
                      <Radar name="Follow-up" dataKey="followup" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <h3 className="font-bold">Top evoluções</h3>
                </div>
                {topImprovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma evolução registrada entre os diagnósticos.</p>
                ) : (
                  <div className="space-y-2">
                    {topImprovements.map((b: any) => (
                      <div key={b.code} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-semibold">{b.code} · {b.title}</p>
                          <p className="text-xs text-muted-foreground">{PILLAR_LABEL[b.pillar]?.label}</p>
                        </div>
                        <Badge className="bg-success/15 text-success">{b.delta}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <h3 className="font-bold">Pontos de atenção</h3>
                </div>
                {topRegressions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma regressão registrada entre os diagnósticos.</p>
                ) : (
                  <div className="space-y-2">
                    {topRegressions.map((b: any) => (
                      <div key={b.code} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-semibold">{b.code} · {b.title}</p>
                          <p className="text-xs text-muted-foreground">{PILLAR_LABEL[b.pillar]?.label}</p>
                        </div>
                        <Badge className="bg-destructive/15 text-destructive">+{b.delta}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4 mt-4">
            <Card className="p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-gold" />
                <h3 className="font-bold">Plano de 90 dias · organizado por Motor</h3>
              </div>
              <div className="space-y-6">
                {MOTORES.map((motor) => {
                  const motorGoals = goals.filter((g) => ((g as any).motor || motorForPillar(g.pillar)) === motor.key);
                  return (
                    <div key={motor.key}>
                      <p className="text-sm font-bold text-gold mb-2">{motor.label}</p>
                      {motorGoals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma meta ativa neste motor.</p>
                      ) : (
                        <div className="space-y-2">
                          {motorGoals.map((g) => (
                            <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3">
                              <div>
                                <p className="text-sm font-semibold">{g.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {g.indicator ? `Indicador: ${g.indicator}` : ""}
                                  {g.due_date ? ` · Prazo: ${format(new Date(g.due_date), "dd/MM/yyyy")}` : ""}
                                  {g.financial_impact ? ` · Impacto: R$ ${Number(g.financial_impact).toLocaleString("pt-BR")}` : ""}
                                </p>
                              </div>
                              <Badge className={GOAL_STATUS_LABEL[g.status]?.color}>
                                {GOAL_STATUS_LABEL[g.status]?.label || g.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Relatórios gerados
        </h3>
        {loadingReports ? (
          <Card className="p-8 text-center text-muted-foreground">Carregando…</Card>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum relatório SEE_4X gerado ainda.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id} className="p-5 shadow-card flex flex-col md:flex-row md:items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">{r.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {r.summary && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {typeof r.summary === "string" ? (
                        r.summary
                      ) : (
                        <span>
                          {(() => {
                            const s = r.summary as Record<string, any>;
                            return `Improviso: ${s.baseline_improviso} → ${s.follow_up_improviso} · IDD: ${s.baseline_idd}% → ${s.follow_up_idd}% · Código ${s.code}`;
                          })()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {r.pdf_url && (
                  <Button variant="outline" onClick={() => download(r.pdf_url, r.title)}>
                    <Download className="h-4 w-4 mr-1" /> PDF
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
