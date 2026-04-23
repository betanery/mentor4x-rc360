
# MENTOR 4X — Sistema premium de execução da mentoria

Reconstrução completa do zero. Sistema **interno** de mentoria (pós-venda, execução e transformação). Não inclui CRM, pipeline, checkout ou captação.

## 🎨 Identidade visual
- **Paleta:** Azul profundo `#112145`, Azul royal `#124378`, Dourado `#CEA32A`, Bege `#F8E19C`, Branco
- **Tipografia:** Montserrat
- **Estilo:** Apple-like minimal × dashboards Monday × cards ClickUp × clareza Notion. Animações suaves, mobile-first, modo claro premium com toques dourados.
- **Tela de boas-vindas:** Frase "O céu não é o limite." + "Sua empresa está mais organizada hoje do que ontem."

## 👥 Acesso e perfis (6 roles)
Email/senha + Google. **Sem signup público** — Super Admin e Mentores convidam usuários por email e os vinculam a uma empresa.
- Super Admin (Roberta), Mentor, Estrategista, Cliente Dono, Gestor Cliente, Colaborador Cliente
- Roles em tabela separada `user_roles` com função `has_role` (segurança server-side)
- Cada role vê só o que pode: clientes não veem outras empresas, colaboradores têm leitura limitada

## 🧱 Módulos (todos os 13 entregues)

**1. Dashboard Executivo** — Score geral, nível de caos (Total/Severo/Moderado/Leve/Escala), 4 scores de pilares, metas da semana com % de execução, gargalos críticos, próxima reunião, alertas, gráfico evolução 90 dias, dependência do dono, receita projetada.

**2. Jornada 4 Meses** — Timeline visual premium com os 4 estágios (Clareza+Prioridade → Execução+Governança → Performance+Consolidação → Autonomia+Escala). Cada mês: objetivos, tarefas, entregáveis, reuniões, checklists, % progresso.

**3. Sistema de Metas (2/semana)** — Board estilo ClickUp. Campos: título, descrição, responsável, prazo, indicador, impacto financeiro (R$), evidência (upload), comentários do mentor. Status: não iniciado / em andamento / concluído / atrasado / bloqueado.

**4. Top 5 Gargalos** — Tela dedicada: nome, área, impacto, urgência, valor financeiro estimado, plano de correção, responsável, progresso.

**5. Pilares 4X** — 4 cards gigantes (Crescimento, Eficiência, Encantamento, Liderança) com score, metas relacionadas, evolução, pontos cegos, recomendações.

**6. Sala de Guerra Semanal** — Tela de reunião com os 5 blocos (Feito / Travou / Indicadores / Próximos Passos / Decisões). Histórico semanal + ata gerada automaticamente pela IA.

**7. Área do Mentor** — Painel com todos os clientes, clientes em risco, baixa execução, metas atrasadas, score por cliente, agenda de reuniões, observações privadas, health score.

**8. Área do Estrategista** — Carteira, follow-up semanal, checklist de cobrança, tarefas abertas, relatórios rápidos, biblioteca de mensagens prontas.

**9. Área do Cliente** — Experiência premium: progresso da empresa, metas atuais, próximas reuniões, wins recentes, trilhas liberadas, solicitações abertas, ranking opcional.

**10. Universidade 4X** — Catálogo de conteúdo por categoria (7 trilhas) com vídeo, PDF, playbooks. Player + progresso por aluno.

**11. IA Conselheira "Meu Sócio IA"** — Chat conversacional com streaming (Lovable AI / Gemini), com contexto da empresa + ações automáticas: gerar plano semanal, sugerir 2 metas, resumir reunião → ata, analisar travas, alertar risco.

**12. Relatórios PDF Premium** — Geração de PDF (evolução mensal, score, gargalos resolvidos, metas concluídas, próximos focos, ROI percebido) com identidade visual.

**13. Certificação Final** — Ao concluir jornada, certificado premium em PDF.

## 🤖 Automações (edge functions agendadas)
- Lembrete de metas atrasadas
- Alerta de baixa execução semanal
- Aviso da próxima reunião
- Resumo semanal automático (IA)
- Ranking de execução
- Cliente sumido há 7 dias
- Parabéns por meta concluída

## 📊 Métricas internas
Taxa de execução semanal, evolução do score, dependência do dono, score de liderança, metas concluídas/mês, gargalos resolvidos, engajamento por login.

## 🗄️ Banco (Lovable Cloud)
Tabelas: `profiles`, `user_roles`, `companies`, `company_members`, `goals`, `goal_updates`, `weekly_reviews`, `bottlenecks`, `pillar_scores`, `meetings`, `meeting_notes`, `tasks`, `playbooks`, `courses`, `lessons`, `lesson_progress`, `reports`, `notifications`, `ai_logs`, `certificates`. RLS rigoroso em todas.

## 🌱 Dados demo
1 empresa demo completa ("Empresa Demo 4X") com metas, gargalos, scores nos 4 pilares, reuniões passadas e futuras, progresso na jornada e usuários de exemplo em cada role para você navegar tudo já populado.

## 🚀 Estratégia de entrega
Construído **tudo de uma vez**, mas em ondas dentro do mesmo build para garantir qualidade:
1. Fundação: design system, auth, roles, banco, navegação por role
2. Núcleo de execução: Dashboard, Metas, Gargalos, Pilares, Jornada
3. Operação: Sala de Guerra, Áreas Mentor/Estrategista/Cliente
4. Conteúdo + IA: Universidade, Meu Sócio IA, Relatórios PDF, Certificado
5. Automações + dados demo + polimento visual

Pronto para evoluir com integrações futuras (financeiro, calendário, WhatsApp).
