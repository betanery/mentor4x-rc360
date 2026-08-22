// Núcleo metodológico do SEE_4X — BlindSpots, Capacidades Estruturantes,
// questionário do Diagnóstico e regras de cálculo (Improviso, Maturidade, IDD).
//
// REGRA DE INDEPENDÊNCIA: Maturidade mostra até onde levar. Improviso mostra por
// onde começar. Uma variável nunca é calculada como o inverso automático da outra —
// a Maturidade sugerida pelo sistema só vale após validação do Consultor 4X.

export type Pillar = "crescimento" | "eficiencia" | "encantamento" | "lideranca";
export type RespondentGroup = "dono_socio" | "gestor" | "equipe";
export type MaturityLevel = "inicial" | "emergente" | "estruturada" | "escalavel" | "autonoma";

/** Pesos oficiais por grupo de respondentes. A mudança começa no CPF do dono. */
export const GROUP_WEIGHTS: Record<RespondentGroup, number> = {
  dono_socio: 0.4,
  gestor: 0.35,
  equipe: 0.25,
};

export const GROUP_LABEL: Record<RespondentGroup, string> = {
  dono_socio: "Dono e sócios",
  gestor: "Gestores",
  equipe: "Equipe",
};

/** Divergência relevante entre grupos, em pontos percentuais. Nunca corrigida automaticamente. */
export const DIVERGENCE_THRESHOLD = 20;

export const MATURITY_LABEL: Record<MaturityLevel, { label: string; description: string; color: string }> = {
  inicial: { label: "M1 · Inicial", description: "Empresa dependente do dono, sem padrões nem indicadores.", color: "bg-destructive/15 text-destructive" },
  emergente: { label: "M2 · Emergente", description: "Primeiros controles e responsáveis definidos, execução instável.", color: "bg-warning/15 text-warning" },
  estruturada: { label: "M3 · Estruturada", description: "Padrões prioritários em uso, indicadores medidos com fonte.", color: "bg-info/15 text-info" },
  escalavel: { label: "M4 · Escalável", description: "Governança ativa, resultados comparáveis à linha de base.", color: "bg-primary/15 text-primary" },
  autonoma: { label: "M5 · Autônoma", description: "Time assume a execução; dono decide, não opera.", color: "bg-success/15 text-success" },
};

export const MATURITY_ORDER: MaturityLevel[] = ["inicial", "emergente", "estruturada", "escalavel", "autonoma"];

/** Faixas de leitura do Improviso (0–100; maior = mais improviso). */
export function improvisoBand(score: number): { key: string; label: string; color: string } {
  if (score >= 80) return { key: "total", label: "Improviso Total", color: "bg-destructive text-destructive-foreground" };
  if (score >= 60) return { key: "severo", label: "Improviso Severo", color: "bg-destructive/80 text-destructive-foreground" };
  if (score >= 40) return { key: "moderado", label: "Improviso Moderado", color: "bg-warning text-warning-foreground" };
  if (score >= 20) return { key: "leve", label: "Improviso Leve", color: "bg-info text-info-foreground" };
  return { key: "escala", label: "Em Escala", color: "bg-success text-success-foreground" };
}

/** Nível de caos legado usado em `companies.chaos_level`. */
export function improvisoToLegacyLevel(score: number): "total" | "severo" | "moderado" | "leve" | "escala" {
  return improvisoBand(score).key as "total" | "severo" | "moderado" | "leve" | "escala";
}

// ---------------------------------------------------------------------------
// 20 BlindSpots oficiais (5 por pilar) e 40 Capacidades Estruturantes (2 por BlindSpot)
// ---------------------------------------------------------------------------

export interface BlindSpot {
  code: string;
  title: string;
  pillar: Pillar;
  /** Afirmação positiva respondida de 1 (não existe) a 5 (totalmente estruturado). */
  statement: string;
  capacities: [string, string];
}

export const BLINDSPOTS: BlindSpot[] = [
  // Crescimento
  { code: "BS-C1", title: "Oferta indefinida", pillar: "crescimento", statement: "A oferta principal é clara, com preço e promessa bem definidos.", capacities: ["Definição de oferta e proposta de valor", "Política de preço e margem"] },
  { code: "BS-C2", title: "Previsibilidade comercial ausente", pillar: "crescimento", statement: "Existe previsibilidade de vendas com meta e pipeline acompanhados.", capacities: ["Funil comercial com etapas", "Rotina de previsão de vendas"] },
  { code: "BS-C3", title: "Geração de demanda improvisada", pillar: "crescimento", statement: "A geração de demanda segue um plano com canais e responsáveis.", capacities: ["Plano de aquisição por canal", "Mensuração de custo de aquisição"] },
  { code: "BS-C4", title: "Time comercial sem método", pillar: "crescimento", statement: "O time comercial trabalha com script, etapas e acompanhamento.", capacities: ["Playbook de vendas", "Ritual de gestão comercial"] },
  { code: "BS-C5", title: "Expansão sem base", pillar: "crescimento", statement: "Novos produtos ou praças só entram com base validada e capacidade instalada.", capacities: ["Critério de validação de expansão", "Planejamento de capacidade"] },
  // Eficiência
  { code: "BS-E1", title: "Processos na cabeça das pessoas", pillar: "eficiencia", statement: "Os processos críticos estão documentados e são seguidos.", capacities: ["Mapeamento de processos críticos", "Padrões operacionais documentados"] },
  { code: "BS-E2", title: "Indicadores sem fonte", pillar: "eficiencia", statement: "Os indicadores têm fonte, responsável e frequência definidos.", capacities: ["Dicionário de indicadores", "Rotina de coleta e conferência"] },
  { code: "BS-E3", title: "Financeiro sem controle", pillar: "eficiencia", statement: "Há controle de caixa, margem e custos com fechamento mensal.", capacities: ["Fluxo de caixa projetado", "Apuração de margem por produto"] },
  { code: "BS-E4", title: "Retrabalho e desperdício", pillar: "eficiencia", statement: "Erros e retrabalhos são registrados e tratados na causa.", capacities: ["Registro de falhas e causas", "Ciclo de melhoria contínua"] },
  { code: "BS-E5", title: "Tecnologia subutilizada", pillar: "eficiencia", statement: "Os sistemas usados sustentam a operação sem controles paralelos.", capacities: ["Inventário e uso de sistemas", "Automação de rotinas manuais"] },
  // Encantamento
  { code: "BS-X1", title: "Jornada do cliente indefinida", pillar: "encantamento", statement: "A jornada do cliente está desenhada do primeiro contato ao pós-venda.", capacities: ["Desenho da jornada do cliente", "Padrão de atendimento por etapa"] },
  { code: "BS-X2", title: "Onboarding travado", pillar: "encantamento", statement: "A entrada de novos clientes segue um onboarding com prazo e checklist.", capacities: ["Onboarding padronizado", "Marco de primeiro valor entregue"] },
  { code: "BS-X3", title: "Sem escuta do cliente", pillar: "encantamento", statement: "A satisfação é medida com frequência e gera ação.", capacities: ["Pesquisa de satisfação recorrente", "Tratamento estruturado de reclamações"] },
  { code: "BS-X4", title: "Retenção não gerenciada", pillar: "encantamento", statement: "Retenção, recompra e churn são acompanhados por indicador.", capacities: ["Gestão de carteira e recompra", "Plano de recuperação de clientes"] },
  { code: "BS-X5", title: "Marca sem consistência", pillar: "encantamento", statement: "A comunicação e a entrega são consistentes com a promessa da marca.", capacities: ["Padrão de identidade e comunicação", "Garantia de padrão de entrega"] },
  // Liderança
  { code: "BS-L1", title: "Dependência do dono", pillar: "lideranca", statement: "A operação segue funcionando sem o dono no dia a dia.", capacities: ["Delegação com alçadas definidas", "Sucessão de decisões operacionais"] },
  { code: "BS-L2", title: "Papéis e accountability difusos", pillar: "lideranca", statement: "Cada frente tem um responsável único e accountable.", capacities: ["Matriz de papéis e responsabilidades", "Acordos de accountability"] },
  { code: "BS-L3", title: "Ausência de rituais de gestão", pillar: "lideranca", statement: "Existem rituais fixos de gestão (check-in semanal e revisão quinzenal).", capacities: ["Cadência de rituais de gestão", "Ata e follow-up de decisões"] },
  { code: "BS-L4", title: "Time sem desenvolvimento", pillar: "lideranca", statement: "O time é treinado nos padrões e avaliado com critério.", capacities: ["Trilha de treinamento nos padrões", "Avaliação de desempenho objetiva"] },
  { code: "BS-L5", title: "Decisão sem dado", pillar: "lideranca", statement: "As decisões relevantes são tomadas com dado e registro.", capacities: ["Painel de decisão gerencial", "Registro de decisões e exceções"] },
];

export const CAPACITIES: { code: string; title: string; blindspot: string; pillar: Pillar }[] = BLINDSPOTS.flatMap((bs) =>
  bs.capacities.map((title, i) => ({ code: `${bs.code}.${i + 1}`, title, blindspot: bs.code, pillar: bs.pillar })),
);

// ---------------------------------------------------------------------------
// IDD — Índice de Dependência do Dono (8 dimensões)
// ---------------------------------------------------------------------------

export const IDD_DIMENSIONS: { key: string; label: string; statement: string }[] = [
  { key: "decisoes", label: "Decisões", statement: "Decisões do dia a dia acontecem sem passar pelo dono." },
  { key: "vendas", label: "Vendas", statement: "As vendas acontecem sem depender do dono para fechar." },
  { key: "financeiro", label: "Financeiro", statement: "A rotina financeira roda sem o dono executar." },
  { key: "operacao", label: "Operação", statement: "A operação entrega o padrão sem o dono acompanhar de perto." },
  { key: "clientes", label: "Clientes", statement: "Os clientes se relacionam com o time, não só com o dono." },
  { key: "equipe", label: "Equipe", statement: "A gestão do time é feita pelos líderes, não pelo dono." },
  { key: "problemas", label: "Problemas", statement: "Problemas são resolvidos pelo time sem escalar ao dono." },
  { key: "conhecimento", label: "Conhecimento", statement: "O conhecimento do negócio está registrado, não na cabeça do dono." },
];

/** Todas as perguntas do questionário, na ordem de aplicação. */
export interface Question {
  id: string;
  section: "pilar" | "idd";
  pillar?: Pillar;
  blindspot?: string;
  label: string;
  statement: string;
}

export const QUESTIONS: Question[] = [
  ...BLINDSPOTS.map<Question>((bs) => ({
    id: bs.code,
    section: "pilar",
    pillar: bs.pillar,
    blindspot: bs.code,
    label: bs.title,
    statement: bs.statement,
  })),
  ...IDD_DIMENSIONS.map<Question>((d) => ({
    id: `IDD-${d.key}`,
    section: "idd",
    label: d.label,
    statement: d.statement,
  })),
];

export const ANSWER_SCALE = [
  { value: 1, label: "Não existe" },
  { value: 2, label: "Existe informalmente" },
  { value: 3, label: "Existe em parte" },
  { value: 4, label: "Estruturado" },
  { value: 5, label: "Estruturado e medido" },
];

export type Answers = Record<string, number>;

/** Converte uma média de respostas (1–5) em score de Improviso (0–100). */
const toImproviso = (avg: number) => Math.round(((5 - avg) / 4) * 100);

function average(values: number[]): number | null {
  const valid = values.filter((v) => typeof v === "number" && v >= 1 && v <= 5);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export interface ResponseInput {
  respondent_group: RespondentGroup;
  respondent_name?: string | null;
  answers: Answers;
}

export interface DiagnosticResult {
  respondents: number;
  groups: { group: RespondentGroup; count: number; improviso: number }[];
  /** Improviso geral consolidado com os pesos oficiais por grupo. */
  improvisoGeral: number;
  byPillar: { pillar: Pillar; improviso: number }[];
  blindspots: { code: string; title: string; pillar: Pillar; improviso: number }[];
  top5: string[];
  priorityPillar: Pillar | null;
  priorityBlindspot: string | null;
  idd: { score: number; dimensions: { key: string; label: string; score: number }[] };
  divergences: { question: string; label: string; spread: number; detail: string }[];
  suggestedMaturity: MaturityLevel;
  maturityCriteria: { label: string; met: boolean }[];
  completeness: number;
  computedAt: string;
}

/**
 * Consolida as respostas de todos os grupos. Os pesos oficiais são renormalizados
 * entre os grupos presentes — grupo ausente não zera o consolidado.
 */
export function computeDiagnostic(responses: ResponseInput[]): DiagnosticResult | null {
  if (!responses.length) return null;

  const groupsPresent = Array.from(new Set(responses.map((r) => r.respondent_group)));
  const weightTotal = groupsPresent.reduce((s, g) => s + GROUP_WEIGHTS[g], 0);

  /** Média ponderada de uma pergunta (ou conjunto) entre grupos. */
  const weightedAvg = (ids: string[]): number | null => {
    let sum = 0;
    let usedWeight = 0;
    for (const g of groupsPresent) {
      const rs = responses.filter((r) => r.respondent_group === g);
      const vals = rs.flatMap((r) => ids.map((id) => r.answers[id]).filter((v) => typeof v === "number"));
      const avg = average(vals);
      if (avg === null) continue;
      sum += avg * GROUP_WEIGHTS[g];
      usedWeight += GROUP_WEIGHTS[g];
    }
    if (!usedWeight) return null;
    return sum / usedWeight;
  };

  const pillarQuestionIds = (p: Pillar) => BLINDSPOTS.filter((b) => b.pillar === p).map((b) => b.code);
  const pillars: Pillar[] = ["crescimento", "eficiencia", "encantamento", "lideranca"];

  const byPillar = pillars.map((pillar) => {
    const avg = weightedAvg(pillarQuestionIds(pillar));
    return { pillar, improviso: avg === null ? 0 : toImproviso(avg) };
  });

  const blindspots = BLINDSPOTS.map((bs) => {
    const avg = weightedAvg([bs.code]);
    return { code: bs.code, title: bs.title, pillar: bs.pillar, improviso: avg === null ? 0 : toImproviso(avg) };
  }).sort((a, b) => b.improviso - a.improviso);

  const allPillarAvg = weightedAvg(BLINDSPOTS.map((b) => b.code));
  const improvisoGeral = allPillarAvg === null ? 0 : toImproviso(allPillarAvg);

  const iddDims = IDD_DIMENSIONS.map((d) => {
    const avg = weightedAvg([`IDD-${d.key}`]);
    return { key: d.key, label: d.label, score: avg === null ? 0 : toImproviso(avg) };
  });
  const iddScore = Math.round(iddDims.reduce((s, d) => s + d.score, 0) / (iddDims.length || 1));

  // Divergência de percepção entre grupos (>= 20 pp). Sinalizada, nunca corrigida.
  const divergences: DiagnosticResult["divergences"] = [];
  for (const q of QUESTIONS) {
    const perGroup = groupsPresent
      .map((g) => {
        const avg = average(responses.filter((r) => r.respondent_group === g).map((r) => r.answers[q.id]));
        return avg === null ? null : { group: g, improviso: toImproviso(avg) };
      })
      .filter(Boolean) as { group: RespondentGroup; improviso: number }[];
    if (perGroup.length < 2) continue;
    const min = Math.min(...perGroup.map((p) => p.improviso));
    const max = Math.max(...perGroup.map((p) => p.improviso));
    if (max - min >= DIVERGENCE_THRESHOLD) {
      divergences.push({
        question: q.id,
        label: q.label,
        spread: max - min,
        detail: perGroup.map((p) => `${GROUP_LABEL[p.group]}: ${p.improviso}`).join(" · "),
      });
    }
  }
  divergences.sort((a, b) => b.spread - a.spread);

  const groups = groupsPresent.map((g) => {
    const rs = responses.filter((r) => r.respondent_group === g);
    const avg = average(rs.flatMap((r) => BLINDSPOTS.map((b) => r.answers[b.code]).filter((v) => typeof v === "number")));
    return { group: g, count: rs.length, improviso: avg === null ? 0 : toImproviso(avg) };
  });

  // Maturidade sugerida: score + critérios mínimos de passagem. Validação é humana.
  const worstPillar = Math.max(...byPillar.map((p) => p.improviso));
  const maturityCriteria = [
    { label: "Improviso geral abaixo de 60", met: improvisoGeral < 60 },
    { label: "Nenhum pilar acima de 70 de Improviso", met: worstPillar <= 70 },
    { label: "Dependência do dono (IDD) abaixo de 50", met: iddScore < 50 },
    { label: "Ao menos dois grupos respondentes", met: groupsPresent.length >= 2 },
  ];
  const metCount = maturityCriteria.filter((c) => c.met).length;
  let suggestedMaturity: MaturityLevel = "inicial";
  if (improvisoGeral < 20 && metCount === 4) suggestedMaturity = "autonoma";
  else if (improvisoGeral < 35 && metCount >= 3) suggestedMaturity = "escalavel";
  else if (improvisoGeral < 50 && metCount >= 2) suggestedMaturity = "estruturada";
  else if (improvisoGeral < 70) suggestedMaturity = "emergente";

  const answeredTotal = responses.reduce(
    (s, r) => s + QUESTIONS.filter((q) => typeof r.answers[q.id] === "number").length,
    0,
  );
  const completeness = Math.round((answeredTotal / (responses.length * QUESTIONS.length)) * 100);

  const priorityPillar = byPillar.slice().sort((a, b) => b.improviso - a.improviso)[0]?.pillar ?? null;

  return {
    respondents: responses.length,
    groups,
    improvisoGeral,
    byPillar,
    blindspots,
    // O sistema sempre recomenda cinco gargalos — o Consultor 4X valida e pode alterar.
    top5: blindspots.slice(0, 5).map((b) => b.code),
    priorityPillar,
    priorityBlindspot: blindspots[0]?.code ?? null,
    idd: { score: iddScore, dimensions: iddDims },
    divergences,
    suggestedMaturity,
    maturityCriteria,
    completeness,
    computedAt: new Date().toISOString(),
  };
}

export const blindspotByCode = (code: string) => BLINDSPOTS.find((b) => b.code === code);

export const capacityByCode = (code: string) => CAPACITIES.find((c) => c.code === code);

/** Urgência do gargalo derivada do Improviso do BlindSpot. */
export function urgencyForImproviso(score: number): "baixa" | "media" | "alta" | "critica" {
  if (score >= 80) return "critica";
  if (score >= 60) return "alta";
  if (score >= 40) return "media";
  return "baixa";
}

