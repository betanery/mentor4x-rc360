# Mentor 4X — Plano de Correção e Evolução (aditivo, sem perda de dados)

Nenhuma alteração foi feita nesta etapa. O plano abaixo parte do que foi verificado no código e no banco agora.

## 1. Diagnóstico do estado real (verificado)

Confirmado
- A migração `20260825104402_...sql` realmente revoga `EXECUTE` de `has_role`, `is_staff` e `is_company_member` para `authenticated` (hoje o privilégio existe só para `postgres` e `service_role`). Outra migração (`20260825103938`) fez o mesmo com `user_companies`. Ao mesmo tempo, mais de 30 políticas RLS chamam essas funções (`companies_select`, `goals_select`, `tasks_modify`, `meetings_*`, `weekly_reviews_*`, políticas de storage em `evidences`/`reports`, etc.). Isso é uma inconsistência real de permissão e o candidato número um a quebrar leitura/escrita pelo cliente autenticado.
- Agente de IA: em `supabase/functions/socio-tools/index.ts` a confirmação (`confirm: true`) chama o modelo **novamente** e executa as propostas do novo retorno. Não há ID, hash ou persistência da proposta exibida — o que é executado pode divergir do que o usuário aprovou. Confirmado.
- Metodologia: em `src/lib/see4x.ts` a maturidade é derivada quase inteiramente do Improviso (`suggestedMaturity` decidido por faixas de `improvisoGeral` + contagem de critérios). Ou seja, hoje as variáveis **não** são independentes. Confirmado.
- Catálogo de produtos: `products` tem apenas nome, slug, descrição, categoria, ativo e ordem; `product_versions` tem rótulo, código de metodologia, ciclos, duração e publicação. Nada de preço, formato, encontros, entregáveis, suporte, herança Master → Start/Pro, upgrades ou links. Não há como cadastrar produto novo sem código.
- Jornada presa à consultoria: o enum `journey_stage` é `mes_1..mes_4, ciclo_1..ciclo_6, concluido`. Produtos com outra estrutura não cabem.
- Top 5 sem histórico: `bottlenecks.rank_position` existe, mas não há tabela de histórico de mudanças de ranking nem garantia de exatamente cinco itens por ciclo.
- Metas sem campos exigidos: `goals` não tem situação atual, resultado esperado, data de validação nem aprovador operacional distinto (`approved_by` é só de alçada de meta crítica).
- URLs assinadas longas: `Playbooks.tsx`, `Journey.tsx`, `Goals.tsx` usam 1 ano; `AdminUniversity.tsx` usa 5 anos. Relatórios/certificados usam 300s (correto).
- Qualidade: 135 erros de ESLint, incluindo 1 violação real de Hooks (`useMemo` condicional). O único teste do projeto é `expect(true).toBe(true)`.
- `admin-list-users` usa `service_role` e devolve todos os usuários, empresas e 200 registros de auditoria para qualquer papel de staff — sem escopo por empresa para Estrategista.

Divergências em relação ao pedido (corrigir o texto, não o código)
- A Escada de Maturidade pedida (Sonho, Sobrevivência, Estruturação, Autonomia, Escala) **não** é a do banco: o enum `maturity_level` é `inicial, emergente, estruturada, escalavel, autonoma`. Não se renomeia enum sem risco; a proposta é manter os valores técnicos e mapear os rótulos novos na interface.
- Os Níveis de Improviso pedidos são quatro (Total, Severo, Moderado, Leve), mas o enum `chaos_level` tem cinco (`total, severo, moderado, leve, escala`) e `improvisoBand` também usa cinco faixas. Proposta: manter cinco no banco e exibir "Em Escala" como faixa de saída, não como nível de improviso.
- Papéis: o pedido cita Super Admin, Consultor, Estrategista e Cliente; o banco tem seis (`cliente_dono`, `gestor_cliente`, `colaborador_cliente` além dos três de staff). Mantemos os seis e tratamos os três de cliente como variações de "Cliente 4X".

## 2. Fases (pequenas, independentes, aditivas)

### Fase 1 — Permissões e alçadas (prioridade máxima)
1a. Validação em runtime: entrar com uma sessão real de cada perfil e registrar quais consultas retornam erro de permissão de função. Só depois aplicar a correção, para provar antes/depois.
1b. Nova migração aditiva que restaura `GRANT EXECUTE ... TO authenticated` apenas em `has_role`, `is_staff`, `is_company_member`, `user_companies`, mantendo `SECURITY DEFINER`, `search_path = public` e o guarda interno já existente (a função só responde para `auth.uid()` ou `service_role`, o que impede sondar papéis de terceiros). Nenhuma migração antiga é editada.
1c. Matriz de alçadas explícita em uma tabela nova `role_capabilities` (papel + capacidade + escopo), lida pela interface e pelas funções, sem mudar políticas existentes. Políticas novas apenas onde a alçada hoje é frouxa (aprovação de meta, alteração de Top 5, aprovação de ata, fechamento de ciclo, certificados).
1d. Interface: `mentor` continua no banco, exibido como "Consultor 4X" (via `src/lib/labels.ts`).
Risco: baixo em 1b (restaura estado anterior a 25/08); médio em 1c se a interface passar a esconder ações que hoje funcionam. Rollback: `REVOKE` correspondente / `drop` da tabela nova.

### Fase 2 — Agente de IA com aprovação fiel
2a. Nova tabela `ai_proposals` (id, empresa, contrato, autor, `tool_name`, `payload` jsonb, `payload_hash`, status, alçada requerida, aprovador, timestamps).
2b. `socio-tools`: modo `propose` grava a proposta e devolve o id; modo `confirm` recebe `proposal_id` + hash, **não chama a IA**, revalida alçada e executa exatamente o payload gravado. Divergência de hash → recusa e exige nova proposta.
2c. Ações reservadas ao Consultor (aprovar meta, mudar Top 5, aprovar ata, fechar ciclo) entram como proposta pendente, nunca como execução direta.
2d. `SocioIA.tsx` passa a exibir proposta, hash curto, alçada e histórico de decisão a partir de `ai_proposals` + `ai_logs`.
Risco: médio (fluxo de UI muda). Rollback: manter o modo antigo atrás de flag por uma versão.

### Fase 3 — Metodologia: Maturidade independente do Improviso
3a. Novo módulo de cálculo: Maturidade a partir de critérios estruturais próprios (capacidades instaladas, evidências, rituais, autonomia de decisão), Improviso a partir das respostas — sem um alimentar o outro.
3b. Mapa de rótulos: Sonho, Sobrevivência, Estruturação, Autonomia, Escala sobre os valores técnicos existentes.
3c. Regra registrada como recomendação: Capacidade Estruturante + Maturidade + Improviso → Meta 4X sugerida, sempre com validação do Consultor.
3d. Diagnóstico: manter respondentes com pesos, divergências visíveis e IDD; separar modo lead x cliente e tornar a recomendação comercial um campo configurável do formulário.
Risco: médio — diagnósticos antigos precisam continuar legíveis. Preservação: cálculo novo grava em campos novos; `results` histórico não é reescrito.

### Fase 4 — Top 5 e Metas
4a. `bottleneck_rank_history` (empresa, contrato, ciclo, gargalo, posição anterior/nova, autor, justificativa) e recomendação automática por criticidade × impacto × urgência, com posição final gravada pelo Consultor.
4b. Colunas aditivas em `goals`: `current_situation`, `expected_result`, `validated_at`, `validated_by`, `notes`. Campos obrigatórios validados por trigger apenas para metas criadas a partir da nova tela, sem invalidar metas antigas.
4c. Manter o limite de duas metas críticas ativas já existente, com o alerta/justificativa/aprovação já implementados; separar visualmente Meta Crítica das ações de execução (tarefas).
Risco: baixo. Rollback: colunas ficam, validação sai.

### Fase 5 — Motor configurável de produtos
5a. Novas tabelas aditivas, sem tocar em `products`/`product_versions`/`contracts` existentes:
`product_version_config` (campos comerciais e operacionais tipados: preço, moeda, formato, público, duração + unidade, acesso, suporte, comunidade, bônus, IA, visibilidade, links, modo de recomendação), `product_version_meetings`, `product_version_stages`, `product_version_deliverables`, `product_inheritance` (base → derivado + componentes herdados/substituídos), `product_upgrade_paths`.
5b. Versão publicada torna-se imutável por trigger; alterar = duplicar versão, editar e publicar. Contratos antigos continuam apontando para a versão comprada.
5c. Jornada por produto: nova tabela `contract_journey_stages` (cópia operacional da versão contratada) em vez do enum fixo. `journey_stage` permanece para o 4X Master e para compatibilidade.
5d. Administração sem JSON cru: construtores por seção (encontros, etapas, entregáveis, suporte) em `AdminProducts.tsx`.
5e. 4X Master = base; 4X Start e 4X Pro cadastrados como derivados com substituições próprias; produtos futuros cadastráveis sem código.
Risco: alto por volume — é a fase que deve ser fatiada em 5a/5b, 5c, 5d, 5e como entregas separadas. Rollback: tabelas novas não usadas não afetam telas atuais.

### Fase 6 — Mensuração, privacidade e qualidade
6a. Score de Estruturação 4X (média ponderada dos quatro pilares, pesos por ciclo registrados em tabela), Índice de Execução (conclusão, prazo, evidência, qualidade), Impacto Econômico (lucro, receita gerada e protegida, custos, margem, caixa, produtividade, retenção), antes/depois, narrativa e Plano de 90 dias — completando o relatório SEE_4X já existente.
6b. Diagnóstico público: consentimento LGPD, limitação de requisições por IP/token, CAPTCHA opcional, UTM já capturado, saída configurável (VSL, WhatsApp, agendamento, checkout), sem expor dados internos.
6c. Higiene técnica: reduzir URLs assinadas para minutos + renovação sob demanda; escopar `admin-list-users` por empresa para Estrategista com paginação; backfill de `contract_id` onde houver contrato único; índices únicos parciais para evitar duplicidade quando `contract_id` é nulo; corrigir a violação de Hooks; primeiros testes reais (cálculo SEE_4X, alçadas, aprovação de proposta de IA); revisão de bundle e lockfile.
Risco: baixo, exceto backfill de `contract_id` (exige relatório prévio e execução por lote reversível).

## 3. Ordem de implementação
Fase 1 → Fase 2 → Fase 4 → Fase 3 → Fase 5 (em quatro entregas) → Fase 6.
Justificativa: acesso e fidelidade das aprovações primeiro; Top 5/metas em seguida porque são o uso diário; metodologia depois; motor de produtos por último por ser o de maior superfície.

## 4. Preservação de dados e rollback
- Somente migrações novas, aditivas e reversíveis; nenhuma migração existente é editada.
- Nenhum `DROP TABLE`, `DROP COLUMN` ou `DELETE` de dados de produção. Renomeações de conceito acontecem na interface.
- Toda migração acompanha o script de reversão (`REVOKE`, `DROP` apenas de objetos criados na própria fase).
- Backfills executados em lote, com consulta de conferência antes e depois.

## 5. Critérios de aceite e testes por perfil
- Super Admin: administra usuários, empresas, catálogo, versões e contratos; vê auditoria completa.
- Consultor 4X: aprova metas, altera Top 5 (com histórico gravado), aprova ata, fecha ciclo, emite certificado; não perde nenhuma capacidade atual.
- Estrategista 4X: conduz encontros e Salas de Guerra, cria rascunhos, registra execução; tentativa de aprovar item reservado é bloqueada no banco, não só na tela.
- Cliente 4X: vê apenas sua empresa e contratos; tentativa de acesso cross-company por API direta retorna vazio/negado.
- IA: proposta confirmada executa exatamente o payload exibido; payload alterado é recusado; toda decisão fica em log.
- Produtos: cadastrar um produto novo derivado do Master, publicar versão, contratar e ver a jornada correta sem alteração de código.
- Regressão: contratos e diagnósticos existentes continuam abrindo, com os mesmos números.

## 6. Observações técnicas
Arquivos e objetos mais afetados: `supabase/functions/socio-tools/index.ts`, `supabase/functions/admin-list-users/index.ts`, `supabase/functions/lead-diagnostic/index.ts`, `src/lib/see4x.ts`, `src/lib/labels.ts`, `src/pages/SocioIA.tsx`, `src/pages/Goals.tsx`, `src/pages/Bottlenecks.tsx`, `src/pages/AdminProducts.tsx`, `src/pages/Journey.tsx`, `src/pages/Diagnostic.tsx`, `src/pages/ReportSee4X.tsx`, `src/pages/AdminUniversity.tsx`, além das tabelas novas descritas nas fases 1c, 2a, 4a e 5a–5c.
