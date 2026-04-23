// Mapeamento de labels em PT-BR para enums do banco

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  mentor: "Mentor",
  estrategista: "Estrategista",
  cliente_dono: "Cliente Dono",
  gestor_cliente: "Gestor",
  colaborador_cliente: "Colaborador",
};

export const CHAOS_LABEL: Record<string, { label: string; color: string }> = {
  total: { label: "Caos Total", color: "bg-destructive text-destructive-foreground" },
  severo: { label: "Caos Severo", color: "bg-destructive/80 text-destructive-foreground" },
  moderado: { label: "Caos Moderado", color: "bg-warning text-warning-foreground" },
  leve: { label: "Caos Leve", color: "bg-info text-info-foreground" },
  escala: { label: "Em Escala", color: "bg-success text-success-foreground" },
};

export const STAGE_LABEL: Record<string, { label: string; subtitle: string }> = {
  mes_1: { label: "Mês 1", subtitle: "Clareza + Prioridade" },
  mes_2: { label: "Mês 2", subtitle: "Execução + Governança" },
  mes_3: { label: "Mês 3", subtitle: "Performance + Consolidação" },
  mes_4: { label: "Mês 4", subtitle: "Autonomia + Escala" },
  concluido: { label: "Concluído", subtitle: "Empresa em controle" },
};

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
