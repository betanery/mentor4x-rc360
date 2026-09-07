# Sala de Guerra — Fase 1: Agenda Microsoft 365 + Teams

## Objetivo

Permitir que o Cliente 4X escolha um horário disponível de um Consultor/Estrategista, bloqueie a agenda Microsoft 365 do profissional, crie um evento de calendário com Microsoft Teams, envie o convite ao participante e registre o encontro automaticamente no Mentor 4X.

## Fluxo implementado

1. Consultor/Estrategista habilita a própria agenda no Mentor 4X.
2. Cliente acessa `/sala-guerra/agendar`.
3. O Mentor consulta a disponibilidade real no Microsoft Graph (`calendar/getSchedule`).
4. Cliente escolhe um slot.
5. Antes de reservar, o backend consulta novamente o horário para impedir dupla reserva.
6. O backend cria um evento calendar-backed no Microsoft 365 com `isOnlineMeeting=true` e `onlineMeetingProvider=teamsForBusiness`.
7. O Microsoft 365 envia o convite ao Cliente.
8. O Mentor registra o encontro na tabela `meetings`, incluindo o ID externo e o link do Teams.
9. O encontro passa a aparecer normalmente na Sala de Guerra, pois `meeting_url` recebe o link do Teams.

## Por que o evento é criado no calendário

A reunião é criada pelo endpoint de eventos do calendário, e não como `onlineMeeting` isolada. Isso mantém o bloqueio da agenda e prepara a Fase 2, em que o Mentor 4X precisará relacionar a reunião às transcrições e artefatos do Teams.

## Secrets necessários na Edge Function

Nunca colocar estes valores no frontend ou no GitHub:

- `MS_GRAPH_TENANT_ID`
- `MS_GRAPH_CLIENT_ID`
- `MS_GRAPH_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `APP_ALLOWED_ORIGINS`

## Microsoft Entra / Graph

Registrar uma aplicação no Microsoft Entra ID e conceder consentimento administrativo para, no mínimo:

- `Calendars.ReadWrite` (Application)

Essa permissão permite consultar disponibilidade e criar eventos nas agendas configuradas para reserva.

Para a Fase 2 serão adicionadas as permissões específicas necessárias para transcrições/gravações, sem antecipá-las neste deploy.

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
