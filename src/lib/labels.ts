// Mapeamento de labels em PT-BR para enums do banco — vocabulário oficial SEE_4X

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  mentor: "Consultor 4X",
  estrategista: "Estrategista 4X",
  cliente_dono: "Cliente 4X (Dono)",
  gestor_cliente: "Gestor",
  colaborador_cliente: "Colaborador",
};

// Improviso substitui a antiga linguagem de "caos". Variável independente da Maturidade.
export const IMPROVISO_LABEL: Record<string, { label: string; color: string }> = {
  total: { label: "Improviso Total", color: "bg-destructive text-destructive-foreground" },
  severo: { label: "Improviso Severo", color: "bg-destructive/80 text-destructive-foreground" },
  moderado: { label: "Improviso Moderado", color: "bg-warning text-warning-foreground" },
  leve: { label: "Improviso Leve", color: "bg-info text-info-foreground" },
  escala: { label: "Em Escala", color: "bg-success text-success-foreground" },
};

// Jornada oficial SEE_4X — 6 ciclos. Valores legados (mes_1..mes_4) permanecem mapeados
// para leitura de registros antigos, mas não são mais oferecidos na interface.
export const CYCLE_LABEL: Record<string, { label: string; subtitle: string; output: string }> = {
  ciclo_1: { label: "Ciclo 1", subtitle: "Clareza e Prioridade", output: "Diagnóstico validado, baseline, Top 5 e Plano de Execução." },
  ciclo_2: { label: "Ciclo 2", subtitle: "Organização e Execução", output: "Responsáveis, controles mínimos, primeiras metas e revisão quinzenal." },
  ciclo_3: { label: "Ciclo 3", subtitle: "Estruturação", output: "Padrões prioritários em uso, indicadores e evidências." },
  ciclo_4: { label: "Ciclo 4", subtitle: "Fortalecimento", output: "Correções aplicadas e estruturas ganhando consistência." },
  ciclo_5: { label: "Ciclo 5", subtitle: "Performance", output: "Resultados comparados à linha de base e decisões de performance." },
  ciclo_6: { label: "Ciclo 6", subtitle: "Autonomia", output: "Reavaliação, antes/depois e Plano de Continuidade de 90 dias." },
  concluido: { label: "Concluído", subtitle: "Empresa estruturada", output: "Plano de Continuidade de 90 dias em execução." },
  // legado
  mes_1: { label: "Ciclo 1", subtitle: "Clareza e Prioridade", output: "Diagnóstico validado, baseline, Top 5 e Plano de Execução." },
  mes_2: { label: "Ciclo 2", subtitle: "Organização e Execução", output: "Responsáveis, controles mínimos, primeiras metas e revisão quinzenal." },
  mes_3: { label: "Ciclo 4", subtitle: "Fortalecimento", output: "Correções aplicadas e estruturas ganhando consistência." },
  mes_4: { label: "Ciclo 6", subtitle: "Autonomia", output: "Reavaliação, antes/depois e Plano de Continuidade de 90 dias." },
};

export const CYCLE_ORDER = ["ciclo_1", "ciclo_2", "ciclo_3", "ciclo_4", "ciclo_5", "ciclo_6", "concluido"] as const;

// Os cinco Motores são cumulativos: cada ciclo destaca um foco sem desligar os anteriores.
export const MOTOR_LABEL: Record<string, string> = {
  clareza: "Clareza",
  prioridade: "Prioridade",
  execucao: "Execução",
  governanca: "Governança",
  autonomia: "Autonomia",
};

export const MOTORES = [
  { key: "clareza", label: MOTOR_LABEL.clareza, cycles: ["ciclo_1"] },
  { key: "prioridade", label: MOTOR_LABEL.prioridade, cycles: ["ciclo_1", "ciclo_2"] },
  { key: "execucao", label: MOTOR_LABEL.execucao, cycles: ["ciclo_2", "ciclo_3"] },
  { key: "governanca", label: MOTOR_LABEL.governanca, cycles: ["ciclo_4", "ciclo_5"] },
  { key: "autonomia", label: MOTOR_LABEL.autonomia, cycles: ["ciclo_6", "concluido"] },
];

export const MEETING_TYPE_LABEL: Record<string, string> = {
  checkin_semanal: "Check-in semanal",
  sala_guerra: "Sala de Guerra (quinzenal)",
  estrategia: "Encontro estratégico",
  kickoff: "Kickoff",
  review: "Review de ciclo",
  // legado: registros antigos gravados como "mentoria" seguem legíveis com o rótulo oficial
  mentoria: "Check-in semanal",
};

// Tipos oferecidos na interface. O valor legado "mentoria" continua aceito no banco,
// mas não é mais ofertado para evitar duas opções com o mesmo significado.
export const MEETING_TYPE_OPTIONS = ["checkin_semanal", "sala_guerra", "estrategia", "kickoff", "review"] as const;

export const GOAL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  nao_iniciado: { label: "Não iniciado", color: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", color: "bg-info/15 text-info" },
  concluido: { label: "Concluído", color: "bg-success/15 text-success" },
  atrasado: { label: "Atrasado", color: "bg-destructive/15 text-destructive" },
  bloqueado: { label: "Bloqueado", color: "bg-warning/15 text-warning" },
};

export const PILLAR_LABEL: Record<string, { label: string; color: string; description: string }> = {
  crescimento: { label: "Crescimento", color: "from-primary to-royal", description: "Receita, vendas e expansão" },
  eficiencia: { label: "Eficiência", color: "from-info to-royal", description: "Processos, custos e produtividade" },
  encantamento: { label: "Encantamento", color: "from-gold to-gold-soft", description: "Cliente, marca e fidelização" },
  lideranca: { label: "Liderança", color: "from-primary to-gold", description: "Time, cultura e autonomia" },
};

export const URGENCY_LABEL: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-info/15 text-info" },
  alta: { label: "Alta", color: "bg-warning/15 text-warning" },
  critica: { label: "Crítica", color: "bg-destructive/15 text-destructive" },
};

export const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
