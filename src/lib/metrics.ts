// Fase 6a — Mensuração SEE_4X: Score de Estruturação, Índice de Execução e
// Impacto Econômico. Funções puras, calculadas a partir de dados já existentes
// (diagnósticos e metas). Nenhuma métrica substitui a validação do Consultor 4X.

import type { Pillar } from "@/lib/see4x";

export const PILLARS: Pillar[] = ["crescimento", "eficiencia", "encantamento", "lideranca"];

/**
 * Pesos dos pilares por ciclo. Ciclos iniciais priorizam Liderança e Eficiência
 * (parar o improviso); ciclos finais priorizam Crescimento e Encantamento (escalar).
 */
export const PILLAR_WEIGHTS_BY_CYCLE: Record<number, Record<Pillar, number>> = {
  1: { lideranca: 0.35, eficiencia: 0.35, encantamento: 0.15, crescimento: 0.15 },
  2: { lideranca: 0.3, eficiencia: 0.3, encantamento: 0.2, crescimento: 0.2 },
  3: { lideranca: 0.25, eficiencia: 0.3, encantamento: 0.2, crescimento: 0.25 },
  4: { lideranca: 0.25, eficiencia: 0.25, encantamento: 0.25, crescimento: 0.25 },
  5: { lideranca: 0.2, eficiencia: 0.25, encantamento: 0.25, crescimento: 0.3 },
  6: { lideranca: 0.2, eficiencia: 0.2, encantamento: 0.25, crescimento: 0.35 },
};

export function pillarWeightsForCycle(cycle?: number | null): Record<Pillar, number> {
  const c = Math.min(6, Math.max(1, Math.round(cycle ?? 1)));
  return PILLAR_WEIGHTS_BY_CYCLE[c];
}

export interface PillarImproviso {
  pillar: Pillar | string;
  improviso: number;
}

export interface StructuringScore {
  /** 0–100, maior = mais estruturado. Inverso ponderado do Improviso por pilar. */
  score: number;
  cycle: number;
  byPillar: { pillar: Pillar; structuring: number; weight: number }[];
}

/** Score de Estruturação 4X — média ponderada dos quatro pilares no ciclo vigente. */
export function structuringScore(byPillar: PillarImproviso[], cycle?: number | null): StructuringScore | null {
  if (!byPillar?.length) return null;
  const weights = pillarWeightsForCycle(cycle);
  let sum = 0;
  let used = 0;
  const detail: StructuringScore["byPillar"] = [];
  for (const p of PILLARS) {
    const found = byPillar.find((x) => x.pillar === p);
    if (!found || typeof found.improviso !== "number") continue;
    const structuring = Math.max(0, Math.min(100, 100 - found.improviso));
    sum += structuring * weights[p];
    used += weights[p];
    detail.push({ pillar: p, structuring, weight: weights[p] });
  }
  if (!used) return null;
  return {
    score: Math.round(sum / used),
    cycle: Math.min(6, Math.max(1, Math.round(cycle ?? 1))),
    byPillar: detail,
  };
}

export interface GoalMetricInput {
  status: string;
  due_date?: string | null;
  evidence_url?: string | null;
  validated_at?: string | null;
  financial_impact?: number | string | null;
  is_critical?: boolean | null;
  updated_at?: string | null;
}

export interface ExecutionIndex {
  /** 0–100 combinando conclusão, prazo, evidência e qualidade. */
  index: number;
  total: number;
  concluded: number;
  components: { key: string; label: string; score: number; weight: number }[];
}

const EXECUTION_WEIGHTS = { conclusao: 0.4, prazo: 0.25, evidencia: 0.2, qualidade: 0.15 };

/** Índice de Execução — conclusão, prazo, evidência e qualidade das metas aprovadas. */
export function executionIndex(goals: GoalMetricInput[], reference = new Date()): ExecutionIndex | null {
  const total = goals.length;
  if (!total) return null;
  const concludedGoals = goals.filter((g) => g.status === "concluido");
  const concluded = concludedGoals.length;

  const conclusao = Math.round((concluded / total) * 100);

  // Prazo: metas concluídas dentro do prazo + metas em curso ainda não vencidas.
  const onTime = goals.filter((g) => {
    if (!g.due_date) return g.status === "concluido";
    const due = new Date(`${g.due_date}T23:59:59`);
    if (g.status === "concluido") {
      const done = g.updated_at ? new Date(g.updated_at) : reference;
      return done <= due;
    }
    return due >= reference;
  }).length;
  const prazo = Math.round((onTime / total) * 100);

  const evidencia = concluded
    ? Math.round((concludedGoals.filter((g) => !!g.evidence_url).length / concluded) * 100)
    : 0;
  const qualidade = concluded
    ? Math.round((concludedGoals.filter((g) => !!g.validated_at).length / concluded) * 100)
    : 0;

  const components = [
    { key: "conclusao", label: "Conclusão", score: conclusao, weight: EXECUTION_WEIGHTS.conclusao },
    { key: "prazo", label: "Prazo", score: prazo, weight: EXECUTION_WEIGHTS.prazo },
    { key: "evidencia", label: "Evidência", score: evidencia, weight: EXECUTION_WEIGHTS.evidencia },
    { key: "qualidade", label: "Qualidade validada", score: qualidade, weight: EXECUTION_WEIGHTS.qualidade },
  ];

  const index = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));
  return { index, total, concluded, components };
}

export interface EconomicImpact {
  /** Impacto de metas concluídas e validadas. */
  realizado: number;
  /** Impacto de metas concluídas ainda sem validação do Consultor. */
  aguardandoValidacao: number;
  /** Impacto previsto em metas em andamento ou não iniciadas. */
  previsto: number;
  /** Impacto ameaçado por metas atrasadas ou bloqueadas. */
  emRisco: number;
  /** Soma de todo o impacto declarado no plano. */
  total: number;
  /** Percentual do total já realizado. */
  conversao: number;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

/** Impacto Econômico do plano — realizado, previsto e em risco. */
export function economicImpact(goals: GoalMetricInput[]): EconomicImpact {
  let realizado = 0;
  let aguardandoValidacao = 0;
  let previsto = 0;
  let emRisco = 0;

  for (const g of goals) {
    const value = num(g.financial_impact);
    if (!value) continue;
    if (g.status === "concluido") {
      if (g.validated_at) realizado += value;
      else aguardandoValidacao += value;
    } else if (g.status === "atrasado" || g.status === "bloqueado") {
      emRisco += value;
    } else {
      previsto += value;
    }
  }

  const total = realizado + aguardandoValidacao + previsto + emRisco;
  return {
    realizado,
    aguardandoValidacao,
    previsto,
    emRisco,
    total,
    conversao: total ? Math.round((realizado / total) * 100) : 0,
  };
}

export const formatBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
