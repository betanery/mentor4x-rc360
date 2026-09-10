# Correção da tela branca em mentor.mentoria4x.com

## O que o erro mostra

No domínio publicado o sistema quebra antes de desenhar qualquer tela, com a mensagem `supabaseUrl is required`. Isso significa que a versão publicada foi gerada **sem** o endereço do backend, então a conexão com dados e login nunca é criada e a página fica em branco. O outro aviso do console (`Permissions policy violation: unload`) é ruído do navegador e não afeta o sistema.

Confirmado nesta análise:
- O ambiente do projeto tem os três valores configurados (endereço, identificador e chave pública) — o preview funciona.
- O arquivo de configuração das funções do backend (`supabase/config.toml`) e o fluxo de publicação no GitHub apontam para um identificador **antigo** de backend (`vvmsikxxoamwqjuihtjk`), diferente do backend real em uso hoje. Publicações automáticas de funções por esse caminho vão para o lugar errado.
- Uma função do backend (`diagnostic-response`) não passa na verificação de tipos, o que impede publicá-la.

## Plano de correção

1. **Republicar o app** para gerar uma versão nova do domínio já com o endereço do backend embutido, e confirmar no domínio que a tela de login aparece.
2. **Rede de segurança visual**: em vez de tela branca, mostrar uma mensagem clara ("não foi possível conectar ao servidor, tente recarregar") quando a conexão com o backend não estiver disponível. Hoje qualquer falha nessa etapa apaga a tela inteira.
3. **Corrigir o identificador do backend** na configuração das funções e no fluxo de publicação, para o backend realmente em uso.
4. **Corrigir o erro de tipos** na função de resposta ao diagnóstico, para que ela volte a poder ser publicada.
5. **Verificar depois da correção**: abrir o domínio publicado, fazer login com a conta da Roberta e conferir Painel, Empresas e Diagnóstico sem erros no console.

## Detalhes técnicos

- `src/integrations/supabase/client.ts` é gerado automaticamente e não será alterado; a proteção entra como boundary de erro na inicialização (`src/main.tsx` / `src/App.tsx`) com fallback visual usando os tokens do design system.
- `supabase/config.toml`: `project_id` passa a `fjgdcmtwstmslmbxlsga`; mesma troca em `.github/workflows/deploy-supabase-edge-functions.yml`.
- `supabase/functions/diagnostic-response/index.ts:112`: `map[loaded.error]` com chave possivelmente `undefined` — estreitar o tipo do erro e usar mensagem padrão de fallback.
- Sem migrações de banco e sem alteração de dados.
