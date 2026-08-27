import { describe, it, expect } from "vitest";
import {
  structuringScore,
  executionIndex,
  economicImpact,
  pillarWeightsForCycle,
} from "@/lib/metrics";

describe("pesos por ciclo", () => {
  it("soma 1 em todos os ciclos", () => {
    for (let c = 1; c <= 6; c++) {
      const w = pillarWeightsForCycle(c);
      const total = w.crescimento + w.eficiencia + w.encantamento + w.lideranca;
      expect(Number(total.toFixed(4))).toBe(1);
    }
  });
  it("limita ciclos fora da faixa", () => {
    expect(pillarWeightsForCycle(0)).toEqual(pillarWeightsForCycle(1));
    expect(pillarWeightsForCycle(99)).toEqual(pillarWeightsForCycle(6));
  });
});

describe("Score de Estruturação 4X", () => {
  it("é o inverso ponderado do Improviso", () => {
    const r = structuringScore(
      [
        { pillar: "crescimento", improviso: 40 },
        { pillar: "eficiencia", improviso: 40 },
        { pillar: "encantamento", improviso: 40 },
        { pillar: "lideranca", improviso: 40 },
      ],
      1,
    );
    expect(r?.score).toBe(60);
  });

  it("pondera mais Liderança no ciclo 1", () => {
    const data = [
      { pillar: "crescimento", improviso: 0 },
      { pillar: "eficiencia", improviso: 0 },
      { pillar: "encantamento", improviso: 0 },
      { pillar: "lideranca", improviso: 100 },
    ];
    const c1 = structuringScore(data, 1)!.score;
    const c6 = structuringScore(data, 6)!.score;
    expect(c1).toBeLessThan(c6);
  });

  it("retorna null sem pilares", () => {
    expect(structuringScore([], 1)).toBeNull();
  });
});

describe("Índice de Execução", () => {
  it("dá 100 para metas concluídas no prazo com evidência e validação", () => {
    const r = executionIndex(
      [
        {
          status: "concluido",
          due_date: "2026-01-10",
          updated_at: "2026-01-05T00:00:00Z",
          evidence_url: "evidencia.pdf",
          validated_at: "2026-01-06T00:00:00Z",
        },
      ],
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(r?.index).toBe(100);
  });

  it("penaliza conclusão sem evidência nem validação", () => {
    const r = executionIndex(
      [{ status: "concluido", due_date: "2026-01-10", updated_at: "2026-01-05T00:00:00Z" }],
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(r?.index).toBe(65);
  });

  it("zera prazo quando a meta está atrasada", () => {
    const r = executionIndex(
      [{ status: "atrasado", due_date: "2026-01-10" }],
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(r?.components.find((c) => c.key === "prazo")?.score).toBe(0);
    expect(r?.index).toBe(0);
  });

  it("retorna null sem metas", () => {
    expect(executionIndex([])).toBeNull();
  });
});

describe("Impacto Econômico", () => {
  it("separa realizado, aguardando validação, previsto e em risco", () => {
    const r = economicImpact([
      { status: "concluido", validated_at: "2026-01-01T00:00:00Z", financial_impact: 100000 },
      { status: "concluido", financial_impact: 50000 },
      { status: "em_andamento", financial_impact: 30000 },
      { status: "bloqueado", financial_impact: 20000 },
      { status: "em_andamento", financial_impact: null },
    ]);
    expect(r.realizado).toBe(100000);
    expect(r.aguardandoValidacao).toBe(50000);
    expect(r.previsto).toBe(30000);
    expect(r.emRisco).toBe(20000);
    expect(r.total).toBe(200000);
    expect(r.conversao).toBe(50);
  });

  it("não divide por zero sem impacto declarado", () => {
    const r = economicImpact([{ status: "concluido" }]);
    expect(r.total).toBe(0);
    expect(r.conversao).toBe(0);
  });
});
