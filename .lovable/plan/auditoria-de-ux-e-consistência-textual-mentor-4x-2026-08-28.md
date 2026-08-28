# Auditoria de UX e consistência textual — Mentor 4X

Varredura de leitura já feita no código: vocabulário SEE_4X, títulos de tela, rótulos de navegação, estados de carregamento/vazio, mensagens de erro e acessibilidade. Abaixo o que está correto e o que precisa de ajuste, com um plano de correção só de apresentação (nenhuma regra de negócio, banco ou permissão muda).

## O que já está consistente

- Nenhum termo proibido visível na interface: "caos", "mentorado", "Área do Mentor", "4 meses" e "Mês 1–4" não aparecem em telas (só em comentários de código e em enums legados do banco, que não são exibidos).
- `index.html` com título, descrição, Open Graph e Twitter Card corretos e em pt-BR.
- Papéis padronizados: Consultor 4X, Estrategista 4X, Cliente 4X.
- Jornada, Diagnóstico, Metas, Top 5 e Relatório SEE_4X usam o vocabulário oficial (Ciclos, Motores, BlindSpot, Improviso, Maturidade, IDD).

## Inconsistências encontradas

### 1. Rótulo de reunião divergente
`src/lib/labels.ts` traduz `mentoria` como "Check-in semanal", mas `VersionConfigDialog.tsx` traduz o mesmo valor como "Encontro de orientação". A mesma reunião aparece com dois nomes dependendo da tela. Além disso, `mentoria` e `checkin_semanal` são oferecidos juntos nas listas de tipos de encontro em `VersionConfigDialog.tsx` e `OnboardingTemplateDialog.tsx`, criando duas opções que significam a mesma coisa.

### 2. Título da tela ≠ item do menu
O usuário clica em um nome e chega em outro:

```text
menu "Metas"            -> título "Sistema de Metas"
menu "Playbooks"        -> título "Biblioteca de Playbooks"
menu "Relatórios"       -> título "Relatórios Premium"
menu "Certificação"     -> título "Certificação SEE_4X"
menu "Empresas"         -> título "Empresas" (ok)
```

### 3. Capitalização de títulos fora do padrão
Quase todas as telas usam Capitalização de Título ("Plano de Ação", "Sala de Guerra"); `AdminUsers` usa "Gerenciar usuários" e `AdminUniversity` usa "Admin · Universidade 4X" (prefixo "Admin ·" só nessa tela, enquanto Produtos/Empresas não têm prefixo).

### 4. Subtítulo diferente para a mesma tela em dois estados
`Diagnostic.tsx` e `ReportSee4X.tsx` têm dois `PageHeader` (estado vazio e estado com dados) com subtítulos distintos, então o texto de apoio muda sozinho conforme o dado carrega.

### 5. Estados vazios e de carregamento desiguais
14 telas têm skeleton/carregamento; ficam sem esse tratamento `Journey`, `WarRoom`, `University`, `Pillars`, `Certificates`, `Reports`, `Dashboard` e `SocioIA` — nelas a tela aparece vazia antes dos dados. Os estados vazios existentes também variam de tom: alguns são frases completas com ponto final ("Nenhum playbook publicado ainda."), outros são fragmentos sem ponto ("Nenhum arquivo"), e a maioria não oferece a próxima ação.

### 6. Mensagens de erro
As mensagens de falha existentes são específicas em alguns pontos ("Erro ao emitir certificado", "Erro ao gerar ata", "Erro ao gerar relatório") e, em outros, repassam o texto cru do backend em inglês para o toast. Não há um padrão único de "o que aconteceu + o que fazer".

### 7. Acessibilidade e imagens
`aria-label` aparece em apenas 6 arquivos; botões de ícone sem rótulo (excluir, editar, reordenar) ficam sem nome acessível. Capas de curso em `AdminUniversity.tsx` usam `alt=""` — sem texto alternativo com o nome do curso.

## Plano de correção (apresentação apenas)

1. **Unificar rótulos de reunião**: `labels.ts` como fonte única; `VersionConfigDialog` e `OnboardingTemplateDialog` passam a consumir `MEETING_TYPE_LABEL` em vez de mapas próprios, e a lista de tipos oferecidos deixa de mostrar `mentoria` (valor legado continua aceito e exibido como "Check-in semanal" para registros antigos).
2. **Alinhar menu e títulos**: menu e `PageHeader` passam a usar o mesmo nome — "Metas", "Playbooks", "Relatórios", "Certificação SEE_4X" (menu ajustado para incluir SEE_4X). Descrição extra vira subtítulo, não título.
3. **Padronizar capitalização**: "Gerenciar Usuários", "Universidade 4X (Admin)" seguindo o mesmo padrão de Produtos e Empresas.
4. **Um subtítulo por tela**: extrair o `PageHeader` de `Diagnostic` e `ReportSee4X` para uma constante única usada nos dois estados.
5. **Estados vazios e de carregamento padronizados**: criar `src/components/EmptyState.tsx` (ícone + frase completa + ação sugerida) e aplicar nos estados vazios existentes; adicionar skeleton nas 8 telas listadas, reaproveitando o padrão já usado em `Goals`/`Bottlenecks`.
6. **Mensagens de erro padronizadas**: helper de toast em pt-BR com título curto e orientação, aplicado onde hoje o erro cru do backend é exibido.
7. **Acessibilidade**: `aria-label` em todos os botões só de ícone, `alt` descritivo nas capas de curso, e checagem de foco visível nos formulários principais.
8. **Verificação final**: percorrer as telas em desktop (1280) e mobile (390) no preview e conferir menu, títulos, estados vazios e um fluxo de erro, com capturas de tela.

## Fora deste escopo

Nada de banco, RLS, edge functions, regras de metodologia ou dados. Enums legados (`mentoria`, `chaos_level`, `mes_1..mes_4`) permanecem no banco intocados — só a apresentação muda.
