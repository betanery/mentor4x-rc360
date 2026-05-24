
# Análise end-to-end do MENTOR 4X

Mapeei rotas, páginas, hooks, RLS, edge functions e fluxos. Abaixo um diagnóstico crítico organizado por **bugs**, **melhorias** e **funcionalidades que faltam**, com prioridade sugerida.

---

## ✅ SPRINTS EXECUTADOS

### Sprint 1 — Segurança e bugs críticos (concluído)
- [x] Edge functions `chat` e `ai-action` agora validam JWT e membership da empresa
- [x] Log de IA movido para server-side (dentro da edge function `chat`)
- [x] Dashboard: score evolution agora usa `pillar_scores` reais agregados por semana
- [x] RLS: restringida edição cross-mentor em `companies` (apenas super_admin ou mentor vinculado à empresa)
- [x] Notifications: filtro por `user_id` + badge no header
- [x] Triggers de `updated_at` em `companies`, `goals`, `bottlenecks`
- [x] Troca de empresa via header atualiza contexto

### Sprint 2 — UX e robustez (concluído)
- [x] Bucket `avatars` com upload de logo em `AdminCompanies` (preview + remoção)
- [x] Bucket `evidences` (privado) com upload de evidências em `Goals`
- [x] `Goals` migrado para React Query com cache invalidation
- [x] `mentor_comment` em metas com UI de feedback do mentor
- [x] Tipos do Supabase (`Tables<"goals">`) integrados

### Sprint 3 — PDFs, certificação e WarRoom completo (concluído)
- [x] Edge function `ai-action` gera PDFs reais com `jsPDF` (relatório mensal, certificados)
- [x] Bucket `reports` privado com signed URLs para download seguro
- [x] `University.tsx`: progresso real por aula (`lesson_progress`)
- [x] `Certificates.tsx`: emissão com código de validação único
- [x] `WarRoom.tsx`: abas Cadência + Reuniões (agendamento) + Notas (públicas/privadas)
- [x] RLS para bucket `reports`

### Sprint 4 — Automação e Jornada (concluído)
- [x] Triggers de notificação automática: nova reunião, meta atrasada/concluída, novo score de pilar
- [x] Tabela `journey_checklist` com progresso persistido por empresa
- [x] `Journey.tsx`: barra de progresso por estágio + botão "Avançar fase" (staff only)
- [x] `Pillars.tsx`: formulário de score do mentor + radar chart com Recharts
- [x] `Notifications.tsx`: React Query + realtime via Supabase Channels + "Marcar todas como lidas"

### Sprint 5 — Sócio IA com function-calling real (concluído)
- [x] Edge function `socio-tools` com function-calling (criar meta, gargalo, reunião)
- [x] Aba "Ações" no Sócio IA: propostas com confirmação humana antes da execução
- [x] Empty-state do Dashboard melhorado (links para Empresas/Notificações)

### Sprint 6 — Polimento e publicação (em andamento)
- [x] Migration de segurança: revoga EXECUTE de funções SECURITY DEFINER para public/anon
- [x] Migration de segurança: DELETE policy em `avatars` e `invite_audit`
- [ ] Ativar leaked password protection (configuração no painel)
- [ ] Publicar app

---

## 🐞 BUGS / CORREÇÕES (alta prioridade)

### 1. `Notifications.tsx` — sem filtro por usuário
```ts
supabase.from("notifications").select("*").order(...)
```
A RLS protege, mas o ideal é `.eq("user_id", user.id)` explícito (performance e clareza). Hoje busca tudo e deixa o Postgres filtrar.

### 2. `Dashboard.tsx` — gráfico de evolução é **mock com `Math.random()`**
```ts
const history = Array.from({ length: 12 }, ...) // simulado
```
Deveria ler `pillar_scores` reais agregados por semana ou criar tabela `company_score_history`. Hoje o cliente vê dado fake.

### 3. `Auth.tsx` — risco de `lock auth-token` (visto nos runtime errors)
Provavelmente `getSession` + `onAuthStateChange` concorrentes ou múltiplas abas. Adicionar `await` correto e tratar `auth-token-steal` para evitar erro no console.

### 4. `useCompany` — `localStorage` pode apontar para empresa removida
Verifica `.find()` mas se for staff e a empresa não existe mais, fica em `null` silenciosamente sem limpar storage.

### 5. `SocioIA.tsx` — log de IA inserido **do client**
```ts
await supabase.from("ai_logs").insert({...})
```
O cliente pode forjar `prompt/response`. Mover para dentro da edge function `chat` (service role).

### 6. `ai-action` e `chat` — **sem verificação de auth nem de membership**
Qualquer pessoa com a anon key pode passar `company_id` arbitrário e receber dados confidenciais da empresa. Crítico.
- Validar JWT do caller
- Validar `is_staff(user) OR is_company_member(user, company_id)` antes de montar contexto

### 7. `monthly_report` em `ai-action` — não preenche `generated_by` nem PDF real
Salva `summary.text` mas a UI promete "PDF premium". Falta geração de PDF (ex.: Puppeteer/Browserless ou template HTML→PDF).

### 8. `supabase/config.toml` — provavelmente sem `verify_jwt = false` para `chat`/`ai-action`
Se `verify_jwt` está true por padrão e a chamada usa anon key, ok; mas se está false sem checagem manual = brecha.

### 9. `tasks`, `meeting_notes` — **sem políticas UPDATE/DELETE para `tasks`** (ok, tem ALL) mas `meeting_notes` não tem update/delete (intencional? autor não pode editar nota própria)

### 10. `companies_staff_modify` permite **qualquer staff editar qualquer empresa**
Mentor B pode alterar empresa do mentor A. Falta isolamento por `is_company_member(user, id) AND member_role IN ('mentor','estrategista')` para edição.

---

## 🔧 MELHORIAS (média prioridade)

### Performance e arquitetura
- **Tipos `any` em massa** nas páginas (`useState<any[]>`). Gerar tipos a partir de `Database` (`Tables<"goals">`).
- Substituir `useEffect + supabase.from` por **`@tanstack/react-query`** (já instalado!). Hoje todo navegar refaz fetch sem cache.
- Realtime para `notifications`, `goals`, `meetings` (canal Postgres changes).
- Paginação em `goals`, `bottlenecks`, `ai_logs` (limite 1000 do Supabase).

### UX
- **Empty states** consistentes (alguns têm, outros não — Pillars, WarRoom).
- **Loading skeletons** em vez de telas vazias enquanto carrega.
- **Confirmação** antes de `delete` em Goals/Bottlenecks/Companies (hoje deleta direto).
- Indicador "não lido" no sino do header (badge com count de `notifications` unread).
- Filtro de empresa no header não persiste corretamente após reload em algumas rotas que dependem de `current`.
- `AdminCompanies` não tem upload de logo apesar do bucket `avatars` existir.
- Mobile: sidebar fecha, mas Dialogs grandes (AdminUsers, AdminCompanies) precisam de revisão de scroll.

### Segurança
- Ativar **leaked password protection (HIBP)** via `configure_auth`.
- RLS em `companies_staff_modify`: restringir DELETE a `super_admin` apenas.
- `ai_logs` — adicionar índice em `(company_id, created_at desc)` e RLS de DELETE/UPDATE explicitamente negados (já estão, ok).
- Adicionar trigger de `updated_at` nas tabelas que têm a coluna mas não trigger (vi `update_updated_at_column` mas nenhum trigger ativo).
- `invite_audit` — TTL/limpeza de convites expirados.

### Código
- Centralizar fetches em `src/lib/api/*.ts` (hoje toda página fala direto com supabase).
- Extrair `<CompanyEmptyState />` reutilizável (repetido em Dashboard, Goals, Bottlenecks…).
- ESLint/typecheck: várias páginas com imports não usados.

---

## 🚧 FUNCIONALIDADES FALTANDO (do que o produto promete)

### Universidade 4X
- **Player de vídeo real** (hoje só lista `video_url`).
- Marcar aula como concluída → atualizar `lesson_progress`.
- Trilha de progresso do aluno + certificado por curso.
- Tela de admin para criar cursos/aulas (hoje só via SQL).

### Certificação
- Geração real de certificado em PDF com QR code e código verificável.
- Endpoint público `/cert/:code` para validação externa.
- Trigger automático: ao mudar `journey_stage` para `concluido`, criar `certificates` row.

### Relatórios
- **PDF real** (hoje só texto markdown salvo). Considerar edge function com `puppeteer` ou serviço externo.
- Tipos: semanal, mensal, fim de jornada.
- Envio por email para o cliente.

### Sala de Guerra (`WarRoom`)
- Não vi conexão completa com `meetings` — agendar reunião, listar histórico, anexar atas a uma `meeting_id`.
- Botão "gerar ata com IA" → ok (existe `weekly_summary`), mas falta salvar como `weekly_review` automaticamente.
- Compartilhar ata com cliente (link público temporário).

### Pilares 4X
- Hoje só lista scores. Falta:
  - Formulário para mentor lançar score do mês com recomendações
  - Gráfico radar comparando meses
  - Sugestões automáticas via IA por pilar abaixo de threshold

### Jornada
- Checklist real por mês (objetivos/deliverables são hardcoded). Persistir progresso por empresa.
- Botão "avançar para próximo mês" para o mentor.

### Metas
- **Evidências**: campo `evidence_url` existe mas não há upload na UI. Conectar com bucket `evidences`.
- Comentários do mentor (`mentor_comment` existe, sem UI).
- Histórico de updates por meta (`goal_updates` existe, sem UI/feed).
- Vista kanban por status (hoje só lista).

### Gargalos
- Atribuir responsável (`responsible_user_id` existe, sem UI).
- Plano de correção em etapas (hoje é texto único).

### Notificações
- Hoje só leitura. Faltam **geradores** automáticos:
  - Meta atrasada → cria notification
  - Reunião em 24h → notification
  - Score caiu > 10pts → notification para staff
- Real-time push (Supabase realtime).
- Email opcional via Lovable Cloud Emails.

### Sócio IA
- Tools/function-calling: deixar o agente **criar metas**, **marcar gargalos**, **agendar reunião** com confirmação.
- Memória por empresa (vetorização de atas/relatórios anteriores).
- Histórico de conversas persistido (`ai_logs` guarda mas não há UI para reabrir).

### Mentor / Estrategista
- Mentor Area lista empresas mas não tem **agenda consolidada** nem **alertas cross-company**.
- Estrategista Area está enxuta — falta dashboard de KPIs agregados (NPS, churn risk, MRR, etc.).
- Vínculo mentor↔empresa (`company_members` com `member_role='mentor'`) não é exposto em UI.

### Onboarding
- Não há fluxo guiado pós-primeiro-login (tour, diagnóstico inicial, definição de pilares).
- Convite aceito → cliente cai direto no Dashboard sem contexto.

### Admin
- Falta página `Admin → Configurações` (branding, templates de email, integrações).
- Logs de auditoria gerais (não só de convites): mudanças críticas em empresa, deleção de metas.

### Integrações
- Calendário (Google/Outlook) para `meetings`.
- WhatsApp para notificações críticas.
- Stripe/Pagamentos para módulo de cobrança da mentoria.

---

## 🗺️ ROADMAP SUGERIDO (ordem de ataque)

**Sprint 1 — Segurança e bugs críticos** (1-2 dias)
1. Auth nas edge functions `chat` e `ai-action` (validar JWT + membership)
2. Mover log de IA para server-side
3. Dashboard: substituir mock por dados reais
4. RLS: restringir edição cross-mentor em `companies`
5. Notifications: filtro por user_id + badge no header

**Sprint 2 — UX e robustez** (3-5 dias)
6. Migrar fetches para React Query + skeletons + confirmações de delete
7. Tipos do Supabase em todas as páginas (remover `any`)
8. Realtime em notifications/goals
9. Upload de evidências em Goals + comentário do mentor + feed `goal_updates`
10. Upload de logo em AdminCompanies

**Sprint 3 — Completar promessas do produto** (1-2 semanas)
11. Universidade: player + progresso + admin
12. Relatórios em PDF real + envio por email
13. Certificação automática + verificação pública
14. WarRoom: ciclo completo de reunião → ata → review
15. Pilares: formulário do mentor + radar
16. Jornada: checklist persistido + avanço de fase

**Sprint 4 — Diferenciais** (contínuo)
17. Sócio IA com tools (criar metas, agendar)
18. Notificações automáticas via triggers + email
19. Integrações calendário/WhatsApp
20. Onboarding guiado pós-convite

---

## Próximo passo

Me diga qual bloco quer atacar primeiro. Recomendo começar pelo **Sprint 1 (segurança)** porque há brechas reais que expõem dados de empresas a usuários não autenticados via as edge functions de IA.
