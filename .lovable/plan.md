# MENTOR 4X — Inventário completo e plano de ajustes

## 1. O que existe hoje (funcionalidades)

### Acesso e usuários
- Login por convite em `/auth` (sem cadastro público), fluxo de definir senha para convite/recuperação.
- Papéis: super_admin, mentor, estrategista, cliente_dono, gestor_cliente, colaborador_cliente (tabela separada `user_roles` + `has_role`).
- Rotas protegidas por papel; áreas de staff separadas.
- Admin → Usuários: convite por e-mail com papel + empresa, badge de status, log de auditoria (`invite_audit`), reenvio de convite.
- Empresas (`/empresas`): CRUD completo, upload de logo, vínculo automático do criador como mentor.

### Execução do método 4X
- Dashboard: score geral, dependência do dono, evolução por `pillar_scores`, atalhos e empty state.
- Jornada: estágios mês 1–4 + concluído, checklist persistido por empresa, avanço de fase (staff).
- Metas: CRUD, status, pilar, responsável, prazo, impacto financeiro, upload de evidência (bucket privado), comentário do mentor, React Query.
- Gargalos: CRUD com urgência, impacto, valor estimado, plano de correção, progresso.
- Pilares: lançamento de score pelo mentor (pontos cegos + recomendações) e radar chart.
- Sala de Guerra: cadência semanal (`weekly_reviews`), agendamento de reuniões, notas públicas/privadas.
- Relatórios: geração de PDF real (jsPDF em edge function) no bucket `reports` com URL assinada.
- Certificados: emissão em PDF com código de validação.
- Universidade 4X: cursos/aulas com progresso por aula e por curso; player via iframe de URL.
- Admin Universidade: CRUD de cursos e aulas, upload de vídeo/PDF, publicar/despublicar, ordenação.
- Sócio IA: chat com contexto da empresa + aba Ações com function-calling (criar meta, gargalo, reunião) com confirmação humana.
- Notificações: lista com realtime, badge no sino, marcar todas como lidas; triggers automáticos (reunião criada, meta atrasada/concluída, novo score).

### Backend
- 22 tabelas com RLS por membership de empresa e papel de staff; grants aplicados.
- 5 edge functions: `chat`, `ai-action`, `socio-tools` (todas validam JWT + membership), `admin-invite`, `admin-list-users`.
- Buckets: `avatars` (público), `evidences`, `lessons`, `reports` (privados com políticas).
- Dados atuais: 2 empresas, 2 usuários, 4 metas, 5 gargalos, 4 scores, 10 cursos, 15 aulas.

## 2. O que precisa de ajuste (por prioridade)

### Alta — quebras funcionais e lacunas de produto
1. **Tabela `tasks` sem nenhuma interface.** Existe no banco, nunca é lida/escrita. Decidir: criar plano de ação por gargalo/reunião ou remover.
2. **Tabela `playbooks` sem interface.** Prometida no produto (biblioteca de playbooks), sem página nem admin.
3. **Feed de `goal_updates` sem UI.** Histórico/comentários por meta não aparecem em nenhum lugar (0 registros).
4. **Player da Universidade**: `iframe src={video_url}` cru — links normais do YouTube não embedam. Falta normalizar URL (watch → embed) e marcar aula concluída ao fim do vídeo.
5. **Certificado sem verificação pública.** Existe `code`, mas não há rota `/cert/:code` para validar externamente, nem emissão automática ao concluir a jornada.
6. **Sem paginação/limite** em Metas, Gargalos, Universidade e `ai_logs` — quebra quando passar de centenas de linhas.
7. **`useCompany`**: se a empresa salva no localStorage for removida, o storage não é limpo; troca de empresa não invalida o cache do React Query (dados de outra empresa podem persistir na tela).

### Média — robustez, UX e consistência
8. Páginas ainda em `useEffect + supabase` sem cache: Dashboard, Bottlenecks, Pillars, WarRoom, Reports, University, MentorArea, StrategistArea. Padronizar em React Query.
9. Tipos `any` remanescentes; usar `Tables<"...">` em todas as páginas.
10. Skeletons de carregamento e empty states consistentes (faltam em Pillars, WarRoom, MentorArea, StrategistArea).
11. Confirmação antes de excluir em Metas e Gargalos.
12. Gargalos sem seleção de responsável (`responsible_user_id` existe e não é usado na UI).
13. Vista Kanban por status em Metas (hoje só lista).
14. Área do Estrategista enxuta: falta painel de KPIs agregados (metas em atraso, scores médios, empresas em risco).
15. Área do Mentor sem agenda consolidada nem alertas cross-company.
16. Ata gerada por IA na Sala de Guerra não é salva automaticamente como `weekly_review`.
17. Mobile: revisar scroll dos diálogos grandes (Admin Usuários, Empresas, Admin Universidade).
18. Onboarding pós-convite: cliente cai direto no Dashboard sem contexto/tour.

### Segurança e operação
19. **Leaked password protection (HIBP) desativado** — ativar na configuração de auth.
20. Bucket `avatars` público (aceitável para logos/capas) — manter documentado na memória de segurança.
21. `invite_audit`: sem limpeza/TTL de convites expirados.
22. Notificações baseadas em tempo (reunião em 24h, meta vencendo) exigem job agendado — hoje só existem triggers por evento.
23. E-mails transacionais com marca MENTOR 4X pendentes: o domínio está verificado mas não vinculado ao projeto, então os convites saem no template padrão.
24. App ainda **não publicado**.

### Integrações ausentes (escopo futuro)
25. Google/Outlook Calendar para reuniões; WhatsApp para alertas críticos; envio de relatórios por e-mail; memória vetorial por empresa no Sócio IA.

## 3. Sequência recomendada de execução

**Bloco A (1 dia)** — itens 1–4 e 7: dar destino a `tasks` e `playbooks`, feed de `goal_updates`, player de vídeo corrigido com conclusão automática, correção do contexto de empresa.

**Bloco B (1–2 dias)** — itens 5, 6, 8–13: verificação pública de certificado, paginação, React Query em todas as páginas, tipos, skeletons, confirmações, responsável em gargalos, Kanban de metas.

**Bloco C (1–2 dias)** — itens 14–18: KPIs do estrategista, agenda do mentor, ata → review automática, mobile, onboarding guiado.

**Bloco D (meio dia)** — itens 19–24: HIBP, TTL de convites, job agendado de notificações, vínculo de domínio + templates branded, publicação.

**Bloco E** — item 25: integrações externas, sob demanda (cada uma exige conexão OAuth/API key).

## Próximo passo
Confirme por qual bloco começar (recomendo o Bloco A) ou aprove para eu executar A e B em sequência.
