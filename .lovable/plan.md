# Correção definitiva da conexão do Mentor 4X

## Diagnóstico confirmado

- O erro ocorre agora tanto no domínio próprio quanto no endereço publicado pelo Lovable: a versão servida foi compilada sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- O Lovable Cloud está saudável; banco de dados e autenticação respondem normalmente. Portanto, não é indisponibilidade dos dados.
- As três configurações existem no ambiente local do projeto, mas o arquivo `.env` é intencionalmente ignorado pelo Git. Uma publicação criada apenas a partir do repositório pode não recebê-las.
- A validação do Git executa o build sem conferir essas configurações. Os testes de navegador usam valores simulados próprios, por isso podem passar mesmo quando a publicação real sair incompleta.
- `supabase/config.toml` ainda aponta para o identificador antigo, enquanto o fluxo de publicação das funções já aponta para o backend atual.
- O alerta de CSP sobre `eval` mostrado no navegador não causou esta tela: a aplicação não registrou exceção; ela própria detectou as duas configurações ausentes e exibiu a proteção criada anteriormente.

## Plano de correção

1. **Tornar a conexão resistente à origem da publicação**
   - Configurar o build para usar as variáveis fornecidas pelo ambiente e, quando elas não forem injetadas, usar os valores públicos deste projeto como fallback seguro.
   - Manter chaves administrativas e segredos completamente fora do navegador e do repositório.
   - Preservar a tela de aviso como última proteção para valores realmente inválidos.

2. **Impedir nova versão quebrada**
   - Criar uma verificação de produção que falhe quando endereço ou chave pública estiverem vazios ou forem placeholders.
   - Executar essa verificação antes do build na validação do Git.
   - Acrescentar um teste do pacote final que confirme que a tela de acesso abre, em vez de apenas depender dos valores simulados dos testes atuais.

3. **Alinhar o backend das funções**
   - Atualizar o identificador antigo em `supabase/config.toml` para o backend atual.
   - Conferir o fluxo manual das funções para garantir que todos os caminhos apontem para o mesmo ambiente.

4. **Validar antes de publicar**
   - Gerar o pacote de produção sem depender do `.env` local e confirmar que ele contém a configuração pública correta.
   - Abrir localmente esse pacote e verificar a tela de acesso sem erros de inicialização.
   - Rodar testes focados de entrada e autenticação, além da checagem de tipos.

5. **Republicar e conferir os dois endereços**
   - Publicar uma nova versão somente após as travas passarem.
   - Confirmar no endereço Lovable e em `mentor.mentoria4x.com` que a tela de acesso aparece.
   - Verificar login e abertura de Painel, Empresas e Diagnóstico.

## Arquivos previstos

- `vite.config.ts`: fallback apenas para configurações públicas de conexão.
- Novo verificador de configuração de produção e ajuste em `package.json`.
- `.github/workflows/security-validation.yml`: trava antes do build real.
- `supabase/config.toml`: alinhamento do identificador do backend.
- Teste de inicialização compilada: cobertura da publicação sem `.env` local.

## Resultado esperado

Uma publicação não voltará a exibir a tela de conexão ausente: ou receberá automaticamente a configuração pública correta, ou será bloqueada antes de substituir a versão válida.
