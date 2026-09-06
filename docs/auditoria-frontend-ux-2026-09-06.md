# Auditoria de Front-end e UX — Mentor 4X

Data: 06/09/2026
Escopo: telas, navegação, digitabilidade, usabilidade, textos, coerência entre módulos, responsividade, acessibilidade básica e performance percebida.
Método: revisão de código + Playwright no GitHub Actions. Nenhuma alteração funcional foi aplicada à `main`.

## Resumo executivo

O sistema tem boa base funcional e já cobre a cadeia principal do Método 4X, mas hoje expõe módulos demais com peso semelhante e depende excessivamente do usuário saber qual tela abrir em seguida. O principal problema não é ausência de funcionalidades isoladas; é a falta de conexões explícitas entre elas.

A arquitetura de informação deve conduzir o usuário por um fluxo operacional simples:

**Onboarding → Diagnóstico → Top 5 Gargalos → Metas Críticas → Plano de Ação → Sala de Guerra → Mensuração/Relatórios.**

Os módulos existem, porém várias transições dependem de voltar ao menu lateral e localizar manualmente a próxima página.

## Críticos

### 1. Acessibilidade na Jornada
O teste automatizado identificou 42 botões sem nome acessível na rota `/jornada`. Controles desse tipo podem ser ambíguos para leitores de tela, navegação por teclado e automações. Cada botão icon-only precisa de `aria-label`, `aria-labelledby`, texto visível ou `title` adequado.

### 2. Jornada reúne conceitos demais
A página `/jornada` concentra ao mesmo tempo:
- seis ciclos fixos da metodologia;
- checklist de objetivos e entregáveis;
- abertura e encerramento de ciclo;
- motores cumulativos;
- encontros do ciclo;
- jornada específica da versão contratada.

Isso mistura visão metodológica, governança operacional e configuração específica do produto. Recomendação: dividir visualmente por abas ou blocos progressivos, priorizando **Ciclo atual** e deixando **Visão dos 6 ciclos** e **Etapas da contratação** como informações secundárias.

## Importantes

### 3. Navegação lateral excessiva
Há muitos módulos comuns disponíveis simultaneamente. A recomendação é agrupar por intenção:
- **Começar:** Dashboard, Onboarding, Diagnóstico;
- **Executar:** Jornada, Gargalos, Metas, Plano de Ação, Sala de Guerra;
- **Aprender:** Universidade, Playbooks, Sócio IA;
- **Medir:** Pilares, Relatórios, Certificação;
- **Administração:** CRM, Consultor, Estrategista, Produtos, Empresas, Universidade Admin.

Isso reduz decisão e facilita treinamento do usuário.

### 4. Falta de CTAs de continuidade entre módulos
As principais pontes que devem ser adicionadas são:
- Diagnóstico validado / Top 5 gerado → **Ver Top 5 Gargalos**;
- Gargalo → **Criar Meta Crítica** e, quando pertinente, **Criar ação**;
- Meta → **Criar tarefa vinculada**;
- tarefa → **Abrir meta relacionada**;
- onboarding 100% → **Iniciar Jornada SEE_4X**;
- empresa sem contratação no onboarding → staff deve ter CTA direto para contratação;
- fechamento de ciclo → CTA para próxima rotina/próxima ação.

### 5. Dois relatórios com nomes muito próximos
`Relatórios` gera relatórios mensais; `Relatório SEE_4X` gera comparação antes/depois e Plano de 90 dias. Para o usuário, a distinção não é evidente. Recomenda-se uma única área **Relatórios**, com abas **Mensal** e **Evolução SEE_4X**, ou renomear de forma muito mais explícita.

### 6. Formulário de Meta Crítica denso
A criação de meta apresenta muitos campos de uma vez: objetivo, descrição, BlindSpot, capacidade, gargalo, pilar, indicador, impacto financeiro, prazo, semana, situação atual, resultado esperado e observações. Recomenda-se fluxo progressivo:
1. Objetivo e resultado;
2. Vínculo metodológico;
3. Medição e governança.

Quando o BlindSpot já define o Pilar, o Pilar deve ser derivado e apresentado como consequência, evitando escolha duplicada.

### 7. Escopo contratado em JSON no Admin de Produtos
O campo `contracted_scope` exige JSON válido. Isso é adequado tecnicamente, mas inadequado para operação cotidiana. Criar um construtor visual com campos/toggles e deixar JSON apenas em modo avançado.

### 8. Performance: bundle inicial grande
O build gera um bundle JavaScript principal em torno de 1,75 MB minificado (aprox. 492 KB gzip), acima do limite de alerta do Vite. Como as páginas são importadas de forma estática, módulos pesados entram no bundle inicial. Recomenda-se `React.lazy`/`Suspense` por rota, especialmente para gráficos, relatórios, Sócio IA e áreas administrativas.

## Melhorias de consistência

### 9. CRM não usa o PageHeader padrão
A maioria das páginas utiliza `PageHeader` com identidade `SEE_4X · RC360`; o CRM cria o próprio cabeçalho. Padronizar.

### 10. Pilares usa estrutura de cabeçalho diferente
A ação “Lançar score” fica fora do `PageHeader`, gerando espaçamento e comportamento distintos. Usar a propriedade `action` do componente padrão.

### 11. Login repete a mesma mensagem
“Acesse o sistema / Entre com sua conta para continuar a jornada” e logo abaixo “Você precisa entrar com sua conta...” repetem o mesmo conceito. Manter uma mensagem curta.

### 12. Textos podem orientar mais a ação e menos a tecnologia
Exemplo: em Relatórios, priorizar o resultado para o usuário (“Consolide evolução, decisões, metas e impacto em PDF”) e deixar “gerado por IA” como informação secundária.

## Pontos positivos

- Login tem labels, fluxo de convite e estados claros.
- Onboarding trata bem ausência de empresa, carregamento, erro com retry, ausência de contratação, progresso e prazo de acesso.
- Empresas possui uma das melhores ligações do sistema: empresa → produto → contratação → geração automática de onboarding → Ver onboarding.
- Plano de Ação tem boa estrutura de tarefa, prioridade, checklist e edição concorrente.
- Universidade trata liberação, expiração e conclusão de conteúdo.
- A navegação mobile crítica passou no teste automatizado em viewport 390×844.
- Os testes existentes de acesso por perfil continuam cobrindo as áreas reservadas.

## Prioridade de correção recomendada

1. Corrigir botões sem nome e demais achados de acessibilidade.
2. Reorganizar menu por intenção/fase de uso.
3. Criar CTAs entre Diagnóstico → Gargalos → Metas → Tarefas → Sala de Guerra.
4. Simplificar Jornada e Meta Crítica por progressive disclosure.
5. Unificar/renomear Relatórios.
6. Remover JSON da operação comum em contratos.
7. Padronizar CRM/Pilares ao PageHeader.
8. Implementar code splitting por rota.

## Critério de conclusão

A correção deve ser considerada concluída quando:
- todas as rotas críticas passarem no Playwright desktop e mobile;
- não houver overflow horizontal relevante;
- não houver botões sem nome acessível nas rotas auditadas;
- cada etapa da cadeia operacional oferecer um próximo passo explícito;
- o usuário não precisar conhecer o menu para avançar no fluxo principal;
- build, TypeScript, unit tests e E2E por perfil permanecerem verdes.
