import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CYCLE_LABEL, CYCLE_ORDER, MOTORES, MEETING_TYPE_LABEL } from "@/lib/labels";
import { CheckCircle2, Target, FileCheck, ArrowRight, Lock, Paperclip, CalendarDays, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


const STAGES = [
  {
    key: "ciclo_1", color: "from-primary to-royal",
    objectives: ["Diagnóstico SEE_4X validado", "Definição dos 5 maiores gargalos", "Clareza de prioridades por pilar", "Calibração das Metas Críticas do ciclo"],
    deliverables: ["Mapa de Improviso", "Top 5 gargalos com plano", "Painel de indicadores (baseline)"],
  },
  {
    key: "ciclo_2", color: "from-primary to-royal",
    objectives: ["Responsáveis definidos por frente", "Controles mínimos instalados", "Check-in semanal ativo", "Sala de Guerra quinzenal em cadência"],
    deliverables: ["Cadência de rituais funcionando", "Primeiras metas com evidência", "Accountability instalado"],
  },
  {
    key: "ciclo_3", color: "from-royal to-info",
    objectives: ["Padrões prioritários em uso", "Indicadores mensurados com fonte", "Evidências anexadas às metas", "Gargalos críticos em correção"],
    deliverables: ["Padrões documentados", "Indicadores em operação", "Evidências auditáveis"],
  },
  {
    key: "ciclo_4", color: "from-info to-gold",
    objectives: ["Correções aplicadas nos gargalos", "Estruturas ganhando consistência", "Dependência do dono caindo", "Time assumindo execução"],
    deliverables: ["Top 5 reavaliado", "Dependência do dono < 50%", "Time treinado nos padrões"],
  },
  {
    key: "ciclo_5", color: "from-info to-gold",
    objectives: ["Resultados comparados ao baseline", "Decisões de performance registradas", "Score de Estruturação em alta", "Impacto econômico mensurado"],
    deliverables: ["Comparativo antes/depois", "Registro de decisões", "Score de Estruturação > 70"],
  },
  {
    key: "ciclo_6", color: "from-gold to-gold-soft",
    objectives: ["Reavaliação completa do diagnóstico", "Empresa operando com autonomia", "Cultura de execução enraizada", "Continuidade desenhada"],
    deliverables: ["Relatório antes/depois", "Plano de Continuidade de 90 dias", "Reavaliação SEE_4X registrada"],
  },
];
const STAGE_ORDER = [...CYCLE_ORDER] as string[];


type CycleRecord = {
  id: string;
  company_id: string;
  cycle: string;
  started_at: string;
  closed_at: string | null;
  closed_by: string | null;
  summary: string | null;
  evidence_url: string | null;
  gate_override_justification: string | null;
};

type ContractStage = {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  cycle_number: number | null;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  completed_at: string | null;
};

const STAGE_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", cls: "bg-gold/20 text-gold" },
  concluida: { label: "Concluída", cls: "bg-success/20 text-success" },
};


export default function Journey() {
  const { current } = useCompany();
  const { currentContract, refreshContracts } = useContract();
  const { isStaff, isConsultor, user } = useAuth();
  const qc = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [justification, setJustification] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: checklist = [] } = useQuery({
    queryKey: ["journey_checklist", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase.from("journey_checklist").select("*").eq("company_id", current!.id);
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: cycleRecords = [] } = useQuery({
    queryKey: ["cycle_records", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = (supabase.from("cycle_records" as any) as any)
        .select("*").eq("company_id", current!.id).order("started_at", { ascending: true });
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data } = await query;
      return (data || []) as CycleRecord[];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["journey_meetings", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("meetings").select("id,title,meeting_type,scheduled_at")
        .eq("company_id", current!.id).order("scheduled_at", { ascending: false }).limit(50);
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data } = await query;
      return data || [];
    },
  });

  // Fase 5c — jornada real da contratação (cópia operacional da versão contratada)
  const { data: contractStages = [] } = useQuery({
    queryKey: ["contract_journey_stages", currentContract?.id],
    enabled: !!currentContract,
    queryFn: async () => {
      const { data, error } = await (supabase.from("contract_journey_stages" as any) as any)
        .select("id,title,description,order_index,cycle_number,status,planned_start,planned_end,completed_at")
        .eq("contract_id", currentContract!.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as ContractStage[];
    },
  });

  const generateJourney = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("generate_contract_journey", { _contract_id: currentContract!.id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} etapa(s) da jornada geradas` : "Jornada já estava gerada");
      qc.invalidateQueries({ queryKey: ["contract_journey_stages"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStageStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await (supabase.from("contract_journey_stages" as any) as any)
        .update({
          status: v.status,
          completed_at: v.status === "concluida" ? new Date().toISOString() : null,
          completed_by: v.status === "concluida" ? user?.id ?? null : null,
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract_journey_stages"] }),
    onError: (e: any) => toast.error(e.message),
  });



  const toggleItem = useMutation({
    mutationFn: async (v: { stage: string; item_key: string; item_type: string; done: boolean }) => {
      if (!current) return;
      const existing = checklist.find((c: any) => c.stage === v.stage && c.item_key === v.item_key && c.item_type === v.item_type);
      if (existing) {
        const { error } = await supabase.from("journey_checklist").update({
          done: v.done, completed_at: v.done ? new Date().toISOString() : null, completed_by: v.done ? user?.id : null,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("journey_checklist").insert({
          company_id: current.id, contract_id: currentContract?.id ?? null, stage: v.stage, item_key: v.item_key, item_type: v.item_type,
          done: v.done, completed_at: v.done ? new Date().toISOString() : null, completed_by: v.done ? user?.id : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journey_checklist"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const isChecked = (stage: string, type: string, key: string) =>
    checklist.find((c: any) => c.stage === stage && c.item_type === type && c.item_key === key)?.done ?? false;

  const stageProgress = (stageKey: string) => {
    const stage = STAGES.find((s) => s.key === stageKey);
    if (!stage) return { done: 0, total: 0, pct: 0 };
    const items = [
      ...stage.objectives.map((o) => ["objective", o] as const),
      ...stage.deliverables.map((d) => ["deliverable", d] as const),
    ];
    const done = items.filter(([t, k]) => isChecked(stageKey, t, k)).length;
    return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  };

  const recordFor = (cycle: string) => cycleRecords.find((r) => r.cycle === cycle);

  const openCycle = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const cycle = currentContract?.journey_stage ?? current.journey_stage;
      const { error } = await (supabase.from("cycle_records" as any) as any)
        .insert({ company_id: current.id, contract_id: currentContract?.id ?? null, cycle });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Abertura do ciclo registrada");
      qc.invalidateQueries({ queryKey: ["cycle_records"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeCycle = useMutation({

    mutationFn: async () => {
      if (!current || !user) return;
      const cycle = currentContract?.journey_stage ?? current.journey_stage;
      const prog = stageProgress(cycle);
      const complete = prog.total > 0 && prog.done === prog.total;
      if (!complete && justification.trim().length < 20) {
        throw new Error("Entregáveis pendentes: descreva a justificativa de fechamento (mínimo 20 caracteres).");
      }
      if (summary.trim().length < 20) {
        throw new Error("Registre um resumo do ciclo com pelo menos 20 caracteres.");
      }

      let evidenceUrl: string | null = null;
      if (evidenceFile) {
        if (evidenceFile.size > 10 * 1024 * 1024) throw new Error("Arquivo de evidência acima de 10MB.");
        const ext = evidenceFile.name.split(".").pop() || "bin";
        const path = `${current.id}/ciclos/${cycle}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("evidences").upload(path, evidenceFile, { contentType: evidenceFile.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("evidences").createSignedUrl(path, 60 * 60 * 24 * 365);
        evidenceUrl = signed?.signedUrl || path;
      }

      const payload = {
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        cycle,
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        summary: summary.trim(),
        evidence_url: evidenceUrl,
        gate_override_justification: complete ? null : justification.trim(),
      };
      const existing = recordFor(cycle);
      if (existing) {
        const { error } = await (supabase.from("cycle_records" as any) as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("cycle_records" as any) as any).insert(payload);
        if (error) throw error;
      }

      const idx = STAGE_ORDER.indexOf(cycle);
      const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
      const { error: stageErr } = currentContract
        ? await supabase.from("contracts").update({ journey_stage: next as any, current_cycle: Math.min((currentContract.current_cycle || 1) + 1, 6) }).eq("id", currentContract.id)
        : await supabase.from("companies").update({ journey_stage: next as any }).eq("id", current.id);
      if (stageErr) throw stageErr;

      if (next !== cycle && !recordFor(next)) {
        await (supabase.from("cycle_records" as any) as any).insert({ company_id: current.id, contract_id: currentContract?.id ?? null, cycle: next });
      }

      await supabase.from("governance_log").insert({
        company_id: current.id,
        actor_id: user.id,
        action: complete ? "ciclo_fechado" : "ciclo_fechado_com_pendencia",
        entity: "cycle_records",
        justification: complete ? summary.trim() : justification.trim(),
        previous_value: CYCLE_LABEL[cycle]?.label ?? cycle,
        new_value: CYCLE_LABEL[next]?.label ?? next,
      });
    },
    onSuccess: () => {
      toast.success("Ciclo encerrado e empresa avançada");
      setCloseOpen(false);
      setSummary(""); setJustification(""); setEvidenceFile(null);
      qc.invalidateQueries({ queryKey: ["cycle_records"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["governance_log"] });
      void refreshContracts();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const overallProgress = useMemo(() => {
    if (!current) return 0;
    const idx = STAGE_ORDER.indexOf(currentContract?.journey_stage ?? current.journey_stage);
    return Math.round((Math.max(idx, 0) / 6) * 100);
  }, [current, currentContract]);

  if (!current) return null;
  const activeStage = currentContract?.journey_stage ?? current.journey_stage;
  const currentIdx = STAGE_ORDER.indexOf(activeStage);
  const currentProgress = stageProgress(activeStage);
  const currentRecord = recordFor(activeStage);
  const cycleStart = currentRecord?.started_at;
  const cycleMeetings = meetings.filter((m: any) => !cycleStart || new Date(m.scheduled_at) >= new Date(cycleStart));


  return (
    <div className="space-y-6">
      <PageHeader title="Jornada SEE_4X — 6 Ciclos" subtitle="A trilha completa do Sistema de Estruturação Empresarial 4X — do improviso à autonomia." />

      <Card className="p-6 shadow-card bg-gradient-brand text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-48 w-48 bg-gold/15 rounded-full blur-3xl" />
        <div className="relative flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Progresso geral</p>
            <div className="mt-2 text-5xl font-black">{overallProgress}%</div>
            <div className="mt-4 h-2 bg-primary-foreground/15 rounded-full overflow-hidden w-64">
              <div className="h-full bg-gradient-gold" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
          {isConsultor && activeStage !== "concluido" && (
            <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gold text-primary hover:bg-gold/90">
                  Encerrar ciclo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Encerrar {CYCLE_LABEL[activeStage]?.label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-bold">Entregáveis e objetivos: {currentProgress.done}/{currentProgress.total}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {currentProgress.done === currentProgress.total && currentProgress.total > 0
                        ? "Ciclo completo — pode ser encerrado com o resumo do período."
                        : "Existem itens pendentes. O encerramento exige justificativa registrada no histórico de decisões."}
                    </p>
                  </div>
                  <div>
                    <Label>Resumo do ciclo</Label>
                    <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4}
                      placeholder="Resultados alcançados, decisões tomadas e próximos focos." />
                  </div>
                  {!(currentProgress.done === currentProgress.total && currentProgress.total > 0) && (
                    <div>
                      <Label>Justificativa de encerramento com pendências</Label>
                      <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3}
                        placeholder="Por que o ciclo avança mesmo com entregáveis abertos e como serão retomados." />
                    </div>
                  )}
                  <div>
                    <Label>Evidência do ciclo (opcional, até 10MB)</Label>
                    <input ref={fileRef} type="file" className="hidden"
                      onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} />
                    <div className="flex items-center gap-2 mt-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                        <Paperclip className="h-4 w-4 mr-1" /> Selecionar arquivo
                      </Button>
                      <span className="text-xs text-muted-foreground truncate">{evidenceFile?.name || "Nenhum arquivo"}</span>
                    </div>
                  </div>
                  <Button className="w-full bg-gradient-brand" disabled={closeCycle.isPending} onClick={() => closeCycle.mutate()}>
                    {closeCycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Encerrar ciclo e avançar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </Card>

      <Card className="p-5 shadow-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Ciclo em andamento</p>
            <h3 className="text-xl font-black mt-1">
              {CYCLE_LABEL[activeStage]?.label} · {CYCLE_LABEL[activeStage]?.subtitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {cycleStart ? `Aberto em ${new Date(cycleStart).toLocaleDateString("pt-BR")}` : "Abertura ainda não registrada"}
              {" · "}{currentProgress.done}/{currentProgress.total} itens concluídos ({currentProgress.pct}%)
            </p>
            <div className="mt-3 h-2 w-64 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-brand" style={{ width: `${currentProgress.pct}%` }} />
            </div>
            {isStaff && !currentRecord && (
              <Button variant="outline" size="sm" className="mt-3" disabled={openCycle.isPending}
                onClick={() => openCycle.mutate()}>
                Registrar abertura do ciclo
              </Button>
            )}
          </div>

          <div className="min-w-[220px]">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Sessões do ciclo
            </p>
            {cycleMeetings.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">Nenhuma sessão registrada neste ciclo.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {cycleMeetings.slice(0, 4).map((m: any) => (
                  <li key={m.id} className="text-xs flex items-center justify-between gap-3">
                    <span className="truncate">{MEETING_TYPE_LABEL[m.meeting_type] || m.title}</span>
                    <span className="text-muted-foreground shrink-0">{new Date(m.scheduled_at).toLocaleDateString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>


      <Card className="p-5 shadow-card">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Cinco Motores · cumulativos</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {MOTORES.map((m, i) => {
            const active = m.cycles.includes(activeStage);
            const reached = m.cycles.some((c) => STAGE_ORDER.indexOf(c) <= currentIdx);
            return (
              <div key={m.key} className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "bg-gold text-gold-foreground border-gold"
                      : reached
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {m.label}
                </span>
                {i < MOTORES.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </Card>

      {currentContract && (
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Jornada da contratação</p>
              <h3 className="text-lg font-black mt-1">Etapas do produto contratado</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Cópia operacional das etapas da versão contratada — cada produto tem sua própria estrutura.
              </p>
            </div>
            {isStaff && contractStages.length === 0 && (
              <Button variant="outline" size="sm" disabled={generateJourney.isPending} onClick={() => generateJourney.mutate()}>
                {generateJourney.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Gerar jornada da contratação
              </Button>
            )}
          </div>

          {contractStages.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">
              Nenhuma etapa gerada para esta contratação. A jornada é criada a partir das etapas cadastradas na versão do produto.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {contractStages.map((s) => {
                const st = STAGE_STATUS[s.status] ?? STAGE_STATUS.pendente;
                return (
                  <li key={s.id} className="rounded-lg border p-3 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-muted-foreground">{s.order_index}</span>
                        <p className="font-bold text-sm">{s.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {s.cycle_number ? `Ciclo ${s.cycle_number} · ` : ""}
                        {s.planned_start && s.planned_end
                          ? `${new Date(s.planned_start).toLocaleDateString("pt-BR")} → ${new Date(s.planned_end).toLocaleDateString("pt-BR")}`
                          : "Sem datas previstas"}
                        {s.completed_at ? ` · concluída em ${new Date(s.completed_at).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    </div>
                    {isStaff && (
                      <div className="flex gap-2">
                        {s.status !== "em_andamento" && (
                          <Button variant="outline" size="sm" onClick={() => setStageStatus.mutate({ id: s.id, status: "em_andamento" })}>
                            Em andamento
                          </Button>
                        )}
                        {s.status !== "concluida" ? (
                          <Button size="sm" className="bg-gradient-brand" onClick={() => setStageStatus.mutate({ id: s.id, status: "concluida" })}>
                            Concluir
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setStageStatus.mutate({ id: s.id, status: "pendente" })}>
                            Reabrir
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="space-y-4">
        {STAGES.map((stage, i) => {
          const meta = CYCLE_LABEL[stage.key];
          const record = recordFor(stage.key);
          const prog = stageProgress(stage.key);

          const isCurrent = activeStage === stage.key;
          const isDone = currentIdx > i;
          return (
            <Card key={stage.key} className={`p-6 shadow-card transition-all ${isCurrent ? "ring-2 ring-gold shadow-gold" : ""}`}>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-48 shrink-0">
                  <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${stage.color} flex items-center justify-center text-white shadow-elegant`}>
                    {isDone ? <CheckCircle2 className="h-10 w-10" /> : <span className="text-3xl font-black">{i + 1}</span>}
                  </div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-gold mt-3">{meta.label}</p>
                  <h3 className="text-2xl font-black mt-1">{meta.subtitle}</h3>
                  {isCurrent && <span className="inline-block mt-2 text-[10px] font-bold bg-gold/20 text-gold px-2 py-1 rounded">VOCÊ ESTÁ AQUI</span>}
                  {isDone && <span className="inline-block mt-2 text-[10px] font-bold bg-success/20 text-success px-2 py-1 rounded">CONCLUÍDO</span>}
                  <p className="mt-2 text-[11px] font-bold text-muted-foreground">{prog.done}/{prog.total} itens · {prog.pct}%</p>
                  <p className="mt-3 text-xs text-muted-foreground"><span className="font-bold uppercase tracking-widest text-[10px] block mb-1">Saída principal</span>{meta.output}</p>
                  {record?.closed_at && (
                    <div className="mt-3 rounded-lg border bg-muted/40 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Ciclo encerrado
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(record.closed_at).toLocaleDateString("pt-BR")}
                      </p>
                      {record.summary && <p className="text-[11px] mt-1 line-clamp-4">{record.summary}</p>}
                      {record.gate_override_justification && (
                        <p className="text-[11px] mt-1 text-warning">Pendências justificadas: {record.gate_override_justification}</p>
                      )}
                      {record.evidence_url && (
                        <a href={record.evidence_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary font-bold inline-flex items-center gap-1 mt-1">
                          <Paperclip className="h-3 w-3" /> Evidência
                        </a>
                      )}
                    </div>
                  )}
                </div>



                <div className="flex-1 grid md:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2"><Target className="h-3.5 w-3.5" /> Objetivos</h4>
                    <ul className="space-y-2">
                      {stage.objectives.map((o) => {
                        const checked = isChecked(stage.key, "objective", o);
                        return (
                          <li key={o} className="text-sm flex items-start gap-2">
                            <Checkbox checked={checked} onCheckedChange={(v) => toggleItem.mutate({ stage: stage.key, item_key: o, item_type: "objective", done: !!v })} className="mt-0.5" />
                            <span className={checked ? "line-through text-muted-foreground" : ""}>{o}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2"><FileCheck className="h-3.5 w-3.5" /> Entregáveis</h4>
                    <ul className="space-y-2">
                      {stage.deliverables.map((d) => {
                        const checked = isChecked(stage.key, "deliverable", d);
                        return (
                          <li key={d} className="text-sm flex items-start gap-2">
                            <Checkbox checked={checked} onCheckedChange={(v) => toggleItem.mutate({ stage: stage.key, item_key: d, item_type: "deliverable", done: !!v })} className="mt-0.5" />
                            <span className={checked ? "line-through text-muted-foreground" : ""}>{d}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
