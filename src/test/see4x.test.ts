import { describe, it, expect } from "vitest";
import {
  BLINDSPOTS,
  CAPACITIES,
  GROUP_WEIGHTS,
  IDD_DIMENSIONS,
  MATURITY_DIMENSIONS,
  QUESTIONS,
  computeDiagnostic,
  improvisoBand,
  urgencyForImproviso,
} from "@/lib/see4x";

/** Constrói respostas uniformes para todas as questões do diagnóstico. */
function uniform(value: number): Record<string, number> {
  const answers: Record<string, number> = {};
  QUESTIONS.forEach((q) => {
    answers[q.id] = value;
  });
  return answers;
}

describe("taxonomia SEE_4X", () => {
  it("mantém 20 BlindSpots e 40 Capacidades", () => {
    expect(BLINDSPOTS).toHaveLength(20);
    expect(CAPACITIES).toHaveLength(40);
  });

  it("possui 8 dimensões de IDD e dimensões estruturais de maturidade", () => {
    expect(IDD_DIMENSIONS).toHaveLength(8);
    expect(MATURITY_DIMENSIONS.length).toBeGreaterThanOrEqual(8);
  });

  it("dá mais peso ao dono do que à equipe", () => {
    expect(GROUP_WEIGHTS.dono_socio).toBeGreaterThan(GROUP_WEIGHTS.equipe);
  });
});

describe("computeDiagnostic", () => {
  it("retorna null sem respostas", () => {
    expect(computeDiagnostic([])).toBeNull();
  });

  it("respostas máximas geram improviso mínimo e vice-versa", () => {
    const best = computeDiagnostic([{ respondent_group: "dono_socio", answers: uniform(5) }])!;
    const worst = computeDiagnostic([{ respondent_group: "dono_socio", answers: uniform(1) }])!;
    expect(best.improvisoGeral).toBeLessThan(worst.improvisoGeral);
    expect(best.improvisoGeral).toBeGreaterThanOrEqual(0);
    expect(worst.improvisoGeral).toBeLessThanOrEqual(100);
  });

  it("IDD fica na escala 0–100", () => {
    const r = computeDiagnostic([{ respondent_group: "gestor", answers: uniform(3) }])!;
    expect(r.idd.score).toBeGreaterThanOrEqual(0);
    expect(r.idd.score).toBeLessThanOrEqual(100);
  });

  it("Top 5 nunca excede cinco BlindSpots", () => {
    const r = computeDiagnostic([{ respondent_group: "dono_socio", answers: uniform(2) }])!;
    expect(r.top5.length).toBeLessThanOrEqual(5);
  });

  it("maturidade é independente do improviso (usa dimensões estruturais)", () => {
    const answers = uniform(1);
    MATURITY_DIMENSIONS.forEach((d) => {
      answers[`MAT-${d.key}`] = 5;
    });
    const r = computeDiagnostic([{ respondent_group: "dono_socio", answers }])!;
    expect(r.improvisoGeral).toBeGreaterThan(50);
    expect(r.maturityFromStructure).toBe(true);
    expect(r.maturityScore).toBeGreaterThan(50);
  });
});

describe("faixas e urgência", () => {
  it("classifica improviso alto como faixa crítica e urgência elevada", () => {
    expect(improvisoBand(90).label).toBeTruthy();
    expect(["alta", "critica"]).toContain(urgencyForImproviso(85));
    expect(["baixa", "media"]).toContain(urgencyForImproviso(15));
  });
});
