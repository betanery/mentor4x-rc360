import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Compass, X } from "lucide-react";

type Step = { key: string; title: string; hint: string; to: string; done: boolean };

const dismissKey = (companyId: string, contractId?: string | null) => `m4x.onboarding.dismissed.${companyId}.${contractId ?? "company"}`;

export function OnboardingChecklist({ companyId, contractId }: { companyId: string; contractId?: string | null }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey(companyId, contractId)) === "1");

  const { data } = useQuery({
    queryKey: ["onboarding", companyId, contractId],
    queryFn: async () => {
      const diagnosticsQuery = supabase.from("diagnostics").select("id").eq("company_id", companyId).eq("status", "validado").limit(1);
      const bottlenecksQuery = supabase.from("bottlenecks").select("id").eq("company_id", companyId).limit(1);
      const goalsQuery = supabase.from("goals").select("id").eq("company_id", companyId).limit(1);
      const cyclesQuery = supabase.from("cycle_records").select("id").eq("company_id", companyId).limit(1);
      const meetingsQuery = supabase.from("meetings").select("id").eq("company_id", companyId).limit(1);
      if (contractId) {
        diagnosticsQuery.eq("contract_id", contractId);
        bottlenecksQuery.eq("contract_id", contractId);
        goalsQuery.eq("contract_id", contractId);
        cyclesQuery.eq("contract_id", contractId);
        meetingsQuery.eq("contract_id", contractId);
      }
      const [diagnostics, bottlenecks, goals, cycles, meetings] = await Promise.all([diagnosticsQuery, bottlenecksQuery, goalsQuery, cyclesQuery, meetingsQuery]);
      return {
        diagnostic: (diagnostics.data || []).length > 0,
        bottlenecks: (bottlenecks.data || []).length > 0,
        goals: (goals.data || []).length > 0,
        cycle: (cycles.data || []).length > 0,
        meeting: (meetings.data || []).length > 0,
      };
    },
  });

  if (dismissed || !data) return null;

  const steps: Step[] = [
    { key: "diag", title: "Validar o Diagnóstico SEE_4X", hint: "Respostas consolidadas e baseline aprovada pelo Consultor 4X.", to: "/diagnostico", done: data.diagnostic },
    { key: "top5", title: "Definir o Top 5 de gargalos", hint: "Prioridades geradas a partir dos BlindSpots validados.", to: "/gargalos", done: data.bottlenecks },
    { key: "metas", title: "Registrar as primeiras Metas 4X", hint: "Cada meta ligada a um gargalo e a uma capacidade.", to: "/metas", done: data.goals },
    { key: "ciclo", title: "Abrir o ciclo atual", hint: "Marco de início na Jornada SEE_4X, com evidências por ciclo.", to: "/jornada", done: data.cycle },
    { key: "sala", title: "Agendar a Sala de Guerra", hint: "Ritual quinzenal de decisão, mais o check-in semanal.", to: "/sala-guerra", done: data.meeting },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey(companyId, contractId), "1");
    setDismissed(true);
  };

  return (
    <Card className="p-6 shadow-card border-gold/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">Primeiros passos</p>
          <h3 className="text-lg font-bold flex items-center gap-2 mt-1">
            <Compass className="h-5 w-5 text-royal" /> Ativação do método SEE_4X
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {doneCount} de {steps.length} etapas concluídas para a operação começar completa.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Ocultar primeiros passos">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Progress value={(doneCount / steps.length) * 100} className="mt-4" />

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {steps.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              s.done ? "border-border bg-muted/40" : "border-border hover:border-gold"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.title}</div>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
