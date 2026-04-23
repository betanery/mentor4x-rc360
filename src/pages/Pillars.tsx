import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { PILLAR_LABEL } from "@/lib/labels";
import { Progress } from "@/components/ui/progress";

export default function Pillars() {
  const { current } = useCompany();
  const [scores, setScores] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    if (!current) return;
    Promise.all([
      supabase.from("pillar_scores").select("*").eq("company_id", current.id).order("measured_at", { ascending: false }),
      supabase.from("goals").select("*").eq("company_id", current.id),
    ]).then(([s, g]) => { setScores(s.data || []); setGoals(g.data || []); });
  }, [current]);

  const latest = (key: string) => scores.find((s) => s.pillar === key);
  const evolution = (key: string) => {
    const arr = scores.filter((s) => s.pillar === key).slice(0, 6).reverse();
    return arr;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Pilares 4X" subtitle="Crescimento, Eficiência, Encantamento e Liderança — os quatro eixos do método." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(PILLAR_LABEL).map(([key, p]) => {
          const latestScore = latest(key);
          const score = latestScore?.score || 0;
          const pillarGoals = goals.filter((g) => g.pillar === key);
          const completed = pillarGoals.filter((g) => g.status === "concluido").length;
          const evol = evolution(key);

          return (
            <Card key={key} className="shadow-card overflow-hidden">
              <div className={`p-6 bg-gradient-to-br ${p.color} text-white relative`}>
                <div className="absolute -top-10 -right-10 h-32 w-32 bg-white/10 rounded-full blur-2xl" />
                <p className="text-[10px] font-bold tracking-widest opacity-80 uppercase">Pilar</p>
                <h2 className="text-3xl font-black mt-1">{p.label}</h2>
                <p className="text-sm opacity-90 mt-1">{p.description}</p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-80">Score atual</p>
                    <div className="text-6xl font-black leading-none">{score}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold">{pillarGoals.length} metas</div>
                    <div className="opacity-80">{completed} concluídas</div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Evolução</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {evol.length > 0 ? evol.map((s, i) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-royal to-gold rounded-t" style={{ height: `${s.score}%` }} title={`${s.score}`} />
                    )) : <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>}
                  </div>
                </div>

                {latestScore?.blind_spots && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Pontos cegos</p>
                    <p className="text-sm">{latestScore.blind_spots}</p>
                  </div>
                )}
                {latestScore?.recommendations && (
                  <div className="p-3 bg-gold/10 rounded-lg border border-gold/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-gold mb-1">Recomendações</p>
                    <p className="text-sm">{latestScore.recommendations}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
