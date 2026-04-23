import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { STAGE_LABEL } from "@/lib/labels";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Target, FileCheck, Calendar } from "lucide-react";

const STAGES = [
  {
    key: "mes_1", color: "from-primary to-royal",
    objectives: ["Diagnóstico completo da empresa", "Definição dos 5 maiores gargalos", "Clareza de prioridades por pilar", "Calibração das metas semanais"],
    deliverables: ["Mapa de caos → controle", "Top 5 gargalos com plano", "Painel de indicadores"],
  },
  {
    key: "mes_2", color: "from-royal to-info",
    objectives: ["Implementação da rotina semanal", "Sala de Guerra ativa", "Cobrança e accountability instalados", "Primeiros gargalos resolvidos"],
    deliverables: ["Cadência semanal funcionando", "2 metas/semana com evidência", "Rituais de gestão instalados"],
  },
  {
    key: "mes_3", color: "from-info to-gold",
    objectives: ["Performance dos pilares em alta", "Dependência do dono caindo", "Time assumindo execução", "Indicadores consolidados"],
    deliverables: ["Score geral > 70", "Dependência < 50%", "Time treinado"],
  },
  {
    key: "mes_4", color: "from-gold to-gold-soft",
    objectives: ["Empresa rodando sem o dono", "Score de escala atingido", "Cultura de execução enraizada", "Próximo nível desenhado"],
    deliverables: ["Empresa em escala", "Plano dos próximos 12 meses", "Certificação MENTOR 4X"],
  },
];

export default function Journey() {
  const { current } = useCompany();
  const [goals, setGoals] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    if (!current) return;
    Promise.all([
      supabase.from("goals").select("*").eq("company_id", current.id),
      supabase.from("meetings").select("*").eq("company_id", current.id),
    ]).then(([g, m]) => { setGoals(g.data || []); setMeetings(m.data || []); });
  }, [current]);

  if (!current) return null;
  const currentIdx = ["mes_1","mes_2","mes_3","mes_4","concluido"].indexOf(current.journey_stage);
  const overallProgress = Math.round((currentIdx / 4) * 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Jornada 4 Meses" subtitle="A trilha completa da Mentoria 4X — do caos ao controle, e do controle à escala." />

      <Card className="p-6 shadow-card bg-gradient-brand text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-48 w-48 bg-gold/15 rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Progresso geral</p>
          <div className="mt-2 text-5xl font-black">{overallProgress}%</div>
          <div className="mt-4 h-2 bg-primary-foreground/15 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-gold" style={{ width: `${overallProgress}%` }} />
          </div>
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
                    <ul className="space-y-1.5">
                      {stage.objectives.map((o) => (
                        <li key={o} className="text-sm flex items-start gap-2">
                          <Circle className="h-3.5 w-3.5 mt-0.5 text-royal shrink-0" />{o}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2"><FileCheck className="h-3.5 w-3.5" /> Entregáveis</h4>
                    <ul className="space-y-1.5">
                      {stage.deliverables.map((d) => (
                        <li key={d} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-gold shrink-0" />{d}
                        </li>
                      ))}
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
