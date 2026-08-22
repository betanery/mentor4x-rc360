import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CYCLE_LABEL, CYCLE_ORDER, MOTORES } from "@/lib/labels";
import { CheckCircle2, Target, FileCheck, ArrowRight } from "lucide-react";
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


export default function Journey() {
  const { current } = useCompany();
  const { isStaff, user } = useAuth();
  const qc = useQueryClient();

  const { data: checklist = [] } = useQuery({
    queryKey: ["journey_checklist", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase.from("journey_checklist").select("*").eq("company_id", current!.id);
      return data || [];
    },
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
          company_id: current.id, stage: v.stage, item_key: v.item_key, item_type: v.item_type,
          done: v.done, completed_at: v.done ? new Date().toISOString() : null, completed_by: v.done ? user?.id : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journey_checklist"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const idx = STAGE_ORDER.indexOf(current.journey_stage);
      const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
      const { error } = await supabase.from("companies").update({ journey_stage: next as any }).eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa avançada para próxima fase");
      qc.invalidateQueries({ queryKey: ["companies"] });
      window.location.reload();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isChecked = (stage: string, type: string, key: string) =>
    checklist.find((c: any) => c.stage === stage && c.item_type === type && c.item_key === key)?.done ?? false;

  const overallProgress = useMemo(() => {
    if (!current) return 0;
    const idx = STAGE_ORDER.indexOf(current.journey_stage);
    return Math.round((idx / 4) * 100);
  }, [current]);

  if (!current) return null;
  const currentIdx = STAGE_ORDER.indexOf(current.journey_stage);

  return (
    <div className="space-y-6">
      <PageHeader title="Jornada 4 Meses" subtitle="A trilha completa da Mentoria 4X — do caos ao controle, e do controle à escala." />

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
          {isStaff && current.journey_stage !== "concluido" && (
            <Button onClick={() => advance.mutate()} disabled={advance.isPending} className="bg-gold text-primary hover:bg-gold/90">
              Avançar fase <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        {STAGES.map((stage, i) => {
          const meta = STAGE_LABEL[stage.key];
          const isCurrent = current.journey_stage === stage.key;
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
