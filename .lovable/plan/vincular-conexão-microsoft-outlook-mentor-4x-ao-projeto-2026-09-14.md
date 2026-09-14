# Vincular conexão Microsoft Outlook "MENTOR 4X" ao projeto

## Objetivo
Conectar a conexão de workspace Microsoft Outlook chamada "MENTOR 4X" ao projeto Mentor 4X, para que as Edge Functions recebam o secret `MICROSOFT_OUTLOOK_API_KEY` e a função `teams-calendar` volte a criar eventos no calendário do consultor.

## Passos

1. **Vincular a conexão ao projeto**
   - Usar o connector Microsoft Outlook no Lovable para vincular a conexão existente "MENTOR 4X" (std_01m2g3s0zdf8nsp6hghkw441ts) ao projeto.
   - Isso cria automaticamente o secret `MICROSOFT_OUTLOOK_API_KEY` no backend, acessível via `Deno.env.get("MICROSOFT_OUTLOOK_API_KEY")`.

2. **Verificar secrets disponíveis**
   - Confirmar que `LOVABLE_API_KEY` e `MICROSOFT_OUTLOOK_API_KEY` aparecem nos Secrets do projeto.
   - Confirmar que a conexão está marcada como `uses connector gateway: true`.

3. **Validar o código existente**
   - `supabase/functions/_shared/outlook-gateway.ts` já usa os headers corretos:
     - `Authorization: Bearer ${LOVABLE_API_KEY}`
     - `X-Connection-Api-Key: ${MICROSOFT_OUTLOOK_API_KEY}`
   - `supabase/functions/teams-calendar/index.ts` já chama `outlookFetch` corretamente.
   - Nenhuma alteração de código é necessária se o secret for criado com o nome esperado.

4. **Testar a função teams-calendar**
   - Invocar a Edge Function `teams-calendar` com ação `organizers` para confirmar que a conexão responde.
   - Testar a ação `availability` para garantir que a agenda pode ser consultada.
   - Se o gateway retornar erro de permissão, verificar os scopes OAuth da conexão (Calendars.ReadWrite, User.Read etc.).

5. **Documentar o nome do secret**
   - Registrar no plano/roadmap o nome exato do secret gerado, para referência futura.

## Resultado esperado
- A função `teams-calendar` cria eventos Teams e grava reuniões na tabela `meetings` sem erros de autenticação.
- O secret `MICROSOFT_OUTLOOK_API_KEY` fica disponível para outras Edge Functions que precisem do Outlook.

## Riscos e mitigações
- Se o nome do secret gerado for diferente de `MICROSOFT_OUTLOOK_API_KEY` (ex.: sufixo por ter várias conexões), ajustar `outlook-gateway.ts` para ler o nome correto.
- Se a conexção não tiver permissão de escrita no calendário, será necessário reconectar com os scopes corretos.
