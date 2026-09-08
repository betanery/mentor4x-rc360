# Correção da tela em branco em produção — 07/09/2026

O domínio publicado falhava antes de montar o React, com `Cannot read properties of undefined (reading 'createContext')` no arquivo `vendor-misc`. A mesma exceção foi reproduzida no build local servido por `vite preview`, na posição `vendor-misc-C6Co8haO.js:18:8954`.

A função `manualChunks` agrupava dependências por substrings: o arquivo `vendor-react` importava `vendor-misc`, e `vendor-misc` importava `vendor-react`. O ciclo executava uma biblioteca dependente de React antes de inicializar o export correspondente. A classificação também incluía bibliotecas como `@tanstack/react-query` no grupo React.

A correção remove os agrupamentos manuais e deixa o Rollup determinar os chunks pelo grafo de imports. O carregamento sob demanda das páginas permanece. O bundle inicial passa a aproximadamente 628 KiB nesta instalação, com aviso de tamanho acima de 500 kB; priorizamos restaurar a inicialização. Uma futura otimização deve preservar a ordem de inicialização e passar os testes de produção.

Os testes E2E anteriores executavam `vite dev`, que não usa esse agrupamento de produção. Agora a configuração compila com `vite build` e testa com `vite preview`, sem reutilizar servidor anterior. Os dados e serviços continuam simulados por `VITE_E2E_MODE`; nenhum backend é publicado e nenhum convite real é enviado.

Validação: antes da correção, o teste de entrada falhava com a mesma exceção; depois, 34 E2E passaram, incluindo testes de inicialização sem erros de página e auditorias desktop/mobile com zero achados. Typecheck, 20 testes unitários e 15 testes do backend também passaram.

O aviso `Permissions policy violation: unload` observado no navegador apontava para `chrome-extension://.../frame.js`. É separado da exceção do aplicativo que causava a tela em branco.

A correção está versionada para revisão. O site público só muda após integração e publicação autorizadas; não foi realizado merge nem deploy de backend.
