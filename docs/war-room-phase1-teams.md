# Sala de Guerra — Fase 1: Outlook via Lovable + Teams

## Objetivo

Permitir que o Cliente 4X escolha um horário disponível de um Consultor/Estrategista, bloqueie a agenda Microsoft 365 do profissional, crie um evento de calendário com Microsoft Teams, envie o convite ao participante e registre o encontro automaticamente no Mentor 4X.

## Fluxo implementado

1. A equipe conecta o Microsoft Outlook no Lovable e vincula a conexão ao projeto Mentor 4X. O Consultor/Estrategista cadastra uma agenda acessível à conta conectada; o backend valida edição e suporte ao Teams antes de habilitá-la.
2. Cliente acessa `/sala-guerra/agendar`.
3. O Mentor consulta a disponibilidade real no Outlook pelo connector gateway do Lovable (`calendar/getSchedule`).
4. Cliente escolhe um slot.
5. Antes de reservar, o backend consulta novamente o horário para rejeitar horários que ficaram ocupados (não é uma trava atômica contra requisições simultâneas).
6. O backend cria um evento calendar-backed no Microsoft 365 com `isOnlineMeeting=true` e `onlineMeetingProvider=teamsForBusiness`.
7. O Microsoft 365 envia o convite ao Cliente.
8. O Mentor registra o encontro na tabela `meetings`, incluindo o ID externo e o link do Teams.
9. O encontro passa a aparecer normalmente na Sala de Guerra, pois `meeting_url` recebe o link do Teams.

## Por que o evento é criado no calendário

A reunião é criada pelo endpoint de eventos do calendário, e não como `onlineMeeting` isolada. Isso mantém o bloqueio da agenda e prepara a Fase 2, em que o Mentor 4X precisará relacionar a reunião às transcrições e artefatos do Teams.

## Secrets necessários na Edge Function

Nunca colocar estes valores no frontend ou no GitHub:

- `LOVABLE_API_KEY`
- `MICROSOFT_OUTLOOK_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `APP_ALLOWED_ORIGINS`

## Conexão no Lovable

1. Em **Connectors → Microsoft Outlook**, adicione ou escolha uma conexão Microsoft 365 profissional com calendário e licença Teams.
2. Em **Advanced settings**, confira os escopos delegados: `Calendars.ReadWrite` para a conta conectada; para calendários compartilhados, `Calendars.ReadWrite.Shared`, além do compartilhamento/delegação de edição no Microsoft 365. O consentimento e as políticas do tenant continuam se aplicando.
3. Autorize a conta e vincule a conexão ao projeto **Mentor 4X**. Disponibilidade do conector no catálogo não comprova OAuth concluído nem vínculo com este projeto.
4. Disponibilize os dois secrets acima no ambiente da Edge Function. Não use prefixo `VITE_` nem exponha valores no navegador.
5. Na tela de agendamento, a equipe informa o e-mail do calendário e usa **Validar e habilitar minha agenda**. O backend verifica `canEdit` e `allowedOnlineMeetingProviders` antes de salvar.

Este fluxo usa uma conexão compartilhada do projeto. Cadastrar um e-mail não conecta uma nova identidade Microsoft nem concede acesso ao calendário. Para vários profissionais, cada agenda precisa estar acessível à conta conectada com as permissões delegadas necessárias. O agendamento continua usando `/users/{email}/...` para reservar a agenda selecionada, sem substituí-la silenciosamente por `/me`. Contas independentes exigem um desenho separado com múltiplas conexões ou App User Connectors.

Não é necessário registrar uma aplicação própria para esta Fase 1 nem configurar `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID` ou `MS_GRAPH_CLIENT_SECRET`. Não há fallback para essas variáveis: OAuth, armazenamento e renovação dos tokens Microsoft ficam no Lovable. Secrets antigos poderão ser removidos do ambiente na ativação futura, após confirmar que nenhum outro serviço os utiliza; este PR não altera secrets de produção.

### Contrato do gateway

O transporte server-side está em `supabase/functions/_shared/outlook-gateway.ts`:

```text
https://connector-gateway.lovable.dev/microsoft_outlook/v1.0/users/{email}/...
Authorization: Bearer <LOVABLE_API_KEY>
X-Connection-Api-Key: <MICROSOFT_OUTLOOK_API_KEY>
Content-Type: application/json
Prefer: outlook.timezone="UTC"
```

Operações preservadas: `POST /calendar/getSchedule`, `POST /events` com participante e `teamsForBusiness`, e `DELETE /events/{id}` para compensar falha no banco ou ausência do link Teams. O convite é gerado pelo evento Outlook; não há envio paralelo por e-mail. `calendar_provider=microsoft365` é preservado, pois identifica o calendário de origem, e não o transporte.

Respostas 401/403 orientam revisar conexão e permissões; 429 pede nova tentativa posterior. Erros por calendário dentro de um HTTP 200 e respostas incompletas de disponibilidade interrompem a reserva. Corpos de erro upstream não são repassados ao cliente. A UI limpa os horários antigos ao iniciar nova consulta e apresenta a mensagem do backend.

Fontes: [Microsoft no Lovable](https://docs.lovable.dev/integrations/microsoft), [Gateway-based connectors](https://docs.lovable.dev/integrations/introduction#gateway-based-connectors), [calendários compartilhados/delegados](https://learn.microsoft.com/en-us/graph/outlook-share-or-delegate-calendar), [criação de eventos](https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0).

## Banco

A migration `20260907103000_war_room_phase1_teams_calendar.sql` cria:

- `calendar_booking_hosts`: agendas habilitadas para reserva;
- metadados Microsoft/Teams adicionais em `meetings`;
- índices para sincronização e busca por agenda.

A tabela de hosts fica protegida por RLS. Clientes não leem o e-mail Microsoft diretamente; recebem apenas uma projeção segura da Edge Function.

## Edge Function

`supabase/functions/teams-calendar/index.ts`

Ações atuais:

- `organizers`: lista agendas disponíveis;
- `availability`: consulta horários livres;
- `book`: cria evento + Teams + registro no Mentor;
- `upsert_my_host`: permite que um membro da equipe 4X habilite a própria agenda.

## Regras iniciais

- segunda a sexta;
- janela de trabalho configurável;
- duração configurável por profissional;
- intervalo/buffer configurável;
- antecedência mínima configurável;
- horizonte de reservas configurável;
- rechecagem de disponibilidade imediatamente antes da criação do evento;
- nenhuma senha Microsoft é armazenada no Mentor 4X.

## Ainda não faz parte da Fase 1

- gravação automática;
- coleta de transcrição;
- ata automática baseada na transcrição;
- aprovação e envio do resumo;
- geração automática de tarefas;
- lembretes de execução;
- WhatsApp/BotConversa.

Esses itens pertencem às Fases 2–4.

## Validação e ativação posterior

```sh
npm run build
npm run typecheck
npm exec --yes --package=deno -- deno check --no-lock supabase/functions/teams-calendar/index.ts
npm test
npm run test:backend
npm run test:e2e
```

Os testes do backend executam o handler com Supabase e gateway simulados, cobrindo disponibilidade, conflito, convite Teams, persistência, compensação, permissões e erros. Os E2E simulam respostas da Edge Function e cobrem confirmação desktop/mobile, conflito, conexão negada e configuração pela equipe, além da suíte existente. Não criam convites reais.

Antes da ativação em produção, validar com a conexão real: vínculo e secrets, permissões de cada calendário, disponibilidade, criação do evento com link Teams, recebimento do convite e registro em `meetings`. A confirmação ao vivo depende dessa configuração e de uma futura implantação autorizada.

Este PR não aplica migrations, não publica Edge Functions e não faz merge. A compensação permanece best-effort: se a remoção falhar, o evento precisará de reconciliação manual. A rechecagem de agenda não substitui uma trava transacional entre reservas concorrentes.

Validação local em 07/09/2026: build e typecheck do frontend aprovados; Deno check da Edge Function aprovado; 20 testes unitários, 15 testes do contrato backend e 32 E2E aprovados. As auditorias desktop/mobile existentes retornaram zero achados e zero erros de página.
