# Por que o sistema não aparece no preview

## O que foi verificado agora

- O aplicativo está no ar e sem falhas: a página responde normalmente e a última verificação automática terminou como "tudo certo".
- Ao abrir o endereço principal, o sistema mostra a tela "Acesse o sistema" (e-mail e senha, mais entrar com Google). Isso é o comportamento esperado: todas as áreas internas exigem login.
- Nenhum erro de carregamento apareceu; só avisos técnicos inofensivos.

Ou seja: o sistema aparece, mas como tela de entrada. Sem estar conectada, o preview nunca mostra painel, diagnóstico, metas etc.

## O que proponho fazer

1. Deixar claro na tela de entrada que é preciso entrar para ver o sistema, com uma linha de apoio ("Você precisa entrar com sua conta para acessar os painéis").
2. Tratar a espera de login: hoje, enquanto a sessão é verificada, aparece apenas um ícone girando; vou incluir a marca e a mensagem "Carregando seu acesso" para não parecer tela vazia.
3. Mostrar aviso amigável quando o login falha por conta não confirmada ou senha errada, em português, no lugar da mensagem técnica atual.
4. Confirmar, com um teste de entrada real usando sua conta, que depois do login o painel abre com os dados da empresa de teste — e relatar o que aparecer.

Se, ao entrar, alguma página ficar em branco, esse teste vai apontar exatamente onde e eu corrijo em seguida.

## Detalhes técnicos

- Ajustes visuais em `src/pages/Auth.tsx` e no estado de carregamento de `src/components/ProtectedRoute.tsx`; mensagens de erro traduzidas via `src/lib/feedback.ts`.
- Nenhuma mudança em banco, permissões, rotas ou regras de negócio.
- Validação: `bunx tsgo --noEmit`, `bunx vitest run` e um teste de navegação autenticada contra o preview local.
