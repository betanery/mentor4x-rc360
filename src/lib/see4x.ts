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
  inicial: { label: "M1 · Sonho", description: "Negócio nasce da intenção do dono: sem padrões, sem indicadores, tudo depende dele.", color: "bg-destructive/15 text-destructive" },
  emergente: { label: "M2 · Sobrevivência", description: "Primeiros controles e responsáveis definidos, execução instável e reativa.", color: "bg-warning/15 text-warning" },
  estruturada: { label: "M3 · Estruturação", description: "Padrões prioritários em uso, indicadores com fonte e rituais acontecendo.", color: "bg-info/15 text-info" },
  escalavel: { label: "M4 · Autonomia", description: "Time decide dentro de alçadas, governança ativa e evidências registradas.", color: "bg-primary/15 text-primary" },
  autonoma: { label: "M5 · Escala", description: "Capacidades instaladas sustentam crescimento sem o dono na operação.", color: "bg-success/15 text-success" },
};

export const MATURITY_ORDER: MaturityLevel[] = ["inicial", "emergente", "estruturada", "escalavel", "autonoma"];

/**
 * Dimensões ESTRUTURAIS da Maturidade. Medidas por perguntas próprias — nunca
 * derivadas do Improviso nem do IDD. Improviso mostra por onde começar;
 * Maturidade mostra até onde levar.
 */
export const MATURITY_DIMENSIONS: { key: string; label: string; statement: string }[] = [
  { key: "capacidades", label: "Capacidades instaladas", statement: "As capacidades estruturantes prioritárias estão implantadas e em uso pelo time." },
  { key: "padroes", label: "Padrões em uso", statement: "Os padrões definidos são seguidos mesmo quando a liderança não está presente." },
  { key: "rituais", label: "Rituais de gestão", statement: "Os rituais de gestão acontecem na cadência combinada, com pauta e registro." },
  { key: "evidencias", label: "Evidências", statement: "As entregas e decisões geram evidência registrada e auditável." },
  { key: "indicadores", label: "Indicadores com fonte", statement: "Os indicadores de gestão têm fonte, responsável e são revisados na cadência." },
  { key: "alcadas", label: "Autonomia de decisão", statement: "As decisões acontecem dentro de alçadas claras, sem depender de aprovação do dono." },
  { key: "sucessao", label: "Sucessão e cobertura", statement: "Cada frente crítica tem substituto preparado e conhecimento registrado." },
  { key: "melhoria", label: "Melhoria contínua", statement: "Existe ciclo formal de revisão que corrige padrões e capacidades ao longo do tempo." },
];


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
  section: "pilar" | "idd" | "maturidade";
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
  ...MATURITY_DIMENSIONS.map<Question>((d) => ({
    id: `MAT-${d.key}`,
    section: "maturidade",
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
  /** Score estrutural de Maturidade (0–100). `null` quando o bloco não foi respondido. */
  maturityScore: number | null;
  maturityDimensions: { key: string; label: string; score: number }[];
  /** Verdadeiro quando a Maturidade veio das perguntas estruturais, não de fallback. */
  maturityFromStructure: boolean;

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

  // ---------------------------------------------------------------------------
  // MATURIDADE — calculada SOMENTE pelas perguntas estruturais (MAT-*).
  // Nenhum valor de Improviso ou IDD entra neste cálculo. Diagnósticos antigos,
  // sem o bloco estrutural, caem no fallback histórico e ficam sinalizados.
  // ---------------------------------------------------------------------------
  const maturityDimensions = MATURITY_DIMENSIONS.map((d) => {
    const avg = weightedAvg([`MAT-${d.key}`]);
    return { key: d.key, label: d.label, score: avg === null ? 0 : Math.round(((avg - 1) / 4) * 100), answered: avg !== null };
  });
  const answeredDims = maturityDimensions.filter((d) => d.answered);
  const maturityFromStructure = answeredDims.length >= Math.ceil(MATURITY_DIMENSIONS.length / 2);
  const maturityScore = maturityFromStructure
    ? Math.round(answeredDims.reduce((s, d) => s + d.score, 0) / answeredDims.length)
    : null;

  let suggestedMaturity: MaturityLevel = "inicial";
  let maturityCriteria: { label: string; met: boolean }[];

  if (maturityScore !== null) {
    const weakest = Math.min(...answeredDims.map((d) => d.score));
    const alcadas = maturityDimensions.find((d) => d.key === "alcadas")?.score ?? 0;
    const evidencias = maturityDimensions.find((d) => d.key === "evidencias")?.score ?? 0;
    const rituais = maturityDimensions.find((d) => d.key === "rituais")?.score ?? 0;

    maturityCriteria = [
      { label: "Rituais de gestão acontecendo na cadência (≥ 50)", met: rituais >= 50 },
      { label: "Entregas e decisões com evidência registrada (≥ 50)", met: evidencias >= 50 },
      { label: "Decisões dentro de alçadas definidas (≥ 50)", met: alcadas >= 50 },
      { label: "Nenhuma dimensão estrutural abaixo de 40", met: weakest >= 40 },
    ];
    const metCount = maturityCriteria.filter((c) => c.met).length;

    if (maturityScore >= 85 && metCount === 4) suggestedMaturity = "autonoma";
    else if (maturityScore >= 70 && metCount >= 3) suggestedMaturity = "escalavel";
    else if (maturityScore >= 50 && metCount >= 2) suggestedMaturity = "estruturada";
    else if (maturityScore >= 30) suggestedMaturity = "emergente";
  } else {
    // Fallback de compatibilidade para diagnósticos sem o bloco estrutural.
    const worstPillar = Math.max(...byPillar.map((p) => p.improviso));
    maturityCriteria = [
      { label: "Bloco estrutural de Maturidade não respondido — leitura histórica", met: false },
      { label: "Improviso geral abaixo de 60", met: improvisoGeral < 60 },
      { label: "Nenhum pilar acima de 70 de Improviso", met: worstPillar <= 70 },
      { label: "Ao menos dois grupos respondentes", met: groupsPresent.length >= 2 },
    ];
    if (improvisoGeral < 20) suggestedMaturity = "estruturada";
    else if (improvisoGeral < 50) suggestedMaturity = "emergente";
  }


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
    maturityScore,
    maturityDimensions: maturityDimensions.map(({ key, label, score }) => ({ key, label, score })),
    maturityFromStructure,

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

