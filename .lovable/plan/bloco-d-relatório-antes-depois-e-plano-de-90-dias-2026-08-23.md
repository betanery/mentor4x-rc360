# Bloco D — Relatório Antes/Depois e Plano de 90 dias

Gerar, na tela e em PDF, o relatório comparativo do diagnóstico SEE_4X (antes vs depois) e o plano executivo de 90 dias, respeitando a marca RC360 e a metodologia dos 6 ciclos.

## O que muda para o usuário

### 1. Relatório Antes/Depois
- Nova tela "Relatório SEE_4X" acessível pelo menu lateral para staff e clientes vinculados à empresa.
- O usuário seleciona dois diagnósticos (baseline e follow-up) da mesma empresa.
- O sistema exibe:
  - Comparativo de Maturidade e Improviso entre os dois pontos.
  - Variação percentual por BlindSpot e por Capacidade (ganho/perda).
  - Top 5 BlindSpots que mais evoluíram e os que regrediram.
  - Gráfico de radar comparativo (antes vs depois) por pilar/motor.
  - Resumo executivo em linguagem SEE_4X sem termos proibidos.

### 2. Plano de 90 dias
- Aba ou seção "Plano de 90 dias" dentro do relatório.
- O plano é montado automaticamente a partir das metas ativas aprovadas da empresa, agrupadas por Motor (Clareza → Prioridade → Execução → Governança → Autonomia).
- Cada meta exibe: responsável, prazo, indicador, impacto financeiro estimado e status.
- O plano pode ser exportado em PDF com assinatura RC360.

### 3. PDF institucional
- O PDF de relatório usa o template já existente, mas agora com:
  - Capa com marca Mentor 4X + RC360 / Roberta Cardoso.
  - Página de metodologia SEE_4X (6 ciclos, 5 motores).
  - Página de comparativo antes/depois.
  - Página do plano de 90 dias.
  - Código de validação no rodapé para consulta pública (reaproveita lógica dos certificados).

## Detalhes técnicos

**Banco**
- Reutilizar tabelas existentes: `diagnostics`, `diagnostic_responses`, `goals`, `bottlenecks`, `pillar_scores`, `governance_log`.
- Criar view ou edge function `company_diagnostic_summary` que consolida por empresa:
  - IDs dos diagnósticos baseline e follow-up.
  - Scores de Maturidade e Improviso.
  - Scores por BlindSpot e Capacidade.
- Nenhuma alteração de RLS: manter acesso apenas a membros da empresa e staff.

**Backend (Edge Function)**
- Criar ou estender `supabase/functions/ai-action` com handler `generate-report`:
  - Recebe `company_id`, `baseline_diagnostic_id`, `follow_up_diagnostic_id`.
  - Valida JWT e membership.
  - Busca dados das tabelas acima.
  - Gera PDF com jsPDF já utilizado nos certificados.
  - Salva metadados em nova tabela `reports` (opcional, para histórico) — se aprovado na validação.

**Frontend**
- Criar `src/pages/ReportSee4X.tsx`.
- Componentes reutilizáveis:
  - `DiagnosticSelector`: dropdown de diagnósticos da empresa.
  - `BeforeAfterChart`: radar comparativo com Recharts.
  - `NinetyDayPlan`: lista de metas agrupadas por motor.
  - `ReportActions`: botões "Gerar PDF" e "Compartilhar".
- Atualizar `AppLayout.tsx` e `src/lib/labels.ts` com os novos rótulos.

**Validação antes de encerrar**
- Gerar relatório para empresa com pelo menos dois diagnósticos.
- Conferir se os cálculos de variação batem com os dados brutos.
- Verificar se o PDF respeita a marca (cores #112145, #124378, #C18A09) e não usa termos proibidos.
- Testar em mobile: a tela deve ser legível e o PDF gerado normalmente.

## Fora deste bloco
- Integrações externas (Google Calendar, e-mail transacional, Slack).
- Onboarding interativo passo a passo.
- Dashboard de KPIs para Strategist.
- Refinamentos de UX não críticos.
