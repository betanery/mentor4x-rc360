# Perfis de acesso empresarial: Responsável e Líder da Empresa

Criar dois perfis de acesso — **Responsável pela Empresa** e **Líder da Empresa** — separando papel de acesso de cargo profissional, com escopo configurável, alçadas adicionais, diagnóstico em 4 grupos com pesos configuráveis e RLS equivalente no banco. Nada do que existe hoje é apagado: os papéis legados continuam funcionando e são mapeados.

## 1. Mapeamento dos perfis existentes

Hoje existem 6 papéis em `app_role` e as capacidades vivem em `role_capabilities`:

| Papel atual | Uso hoje | Novo papel equivalente |
|---|---|---|
| super_admin | acesso global (1 usuário) | mantém |
| mentor (Consultor 4X) | valida diagnóstico, aprova Metas 4X, Top 5, ciclos | mantém |
| estrategista | conduz encontros, rascunha metas/atas | mantém |
| cliente_dono | visão da empresa + execução (1 usuário, 1 vínculo) | **company_responsible** (principal) |
| gestor_cliente | visão da empresa + execução (0 usuários) | **company_leader** |
| colaborador_cliente | apenas visualização (0 usuários) | mantém como Equipe |

Os vínculos de empresa ficam em `company_members` (company_id, user_id, member_role, is_primary), sem cargo, sem contrato, sem escopo e sem alçadas — é isso que o novo modelo passa a cobrir.

## 2. Modelo de dados proposto (aditivo)

- `app_role` recebe dois valores novos: `company_responsible` e `company_leader`. Os antigos permanecem válidos.
- Nova tabela `company_access` — o vínculo contextual usuário × empresa × contrato:
  usuário, empresa, contrato (opcional = vale para a empresa toda), papel de acesso, cargo (`dono`, `socio`, `ceo`, `diretor`, `gerente`, `coordenador`, `supervisor`, `outro` + texto livre), departamento, `is_primary_responsible`, grupo do diagnóstico, peso, status (`ativo`/`suspenso`/`encerrado`), vigência (início/fim), autor do convite e datas.
  Regra: no máximo **um** Responsável principal por contrato (índice único parcial).
- Nova tabela `access_scopes` — escopo do Líder, uma linha por permissão de leitura/edição: tipo (`empresa`, `pilar`, `departamento`, `etapa`, `meta`, `indicador`, `documento`) + referência (id ou chave textual). Sem linhas = empresa inteira apenas em leitura básica.
- Nova tabela `access_grants` — alçadas adicionais por vínculo: `invite_members`, `view_financials`, `view_commercial_terms`, `assign_owners`, `validate_evidence`, `update_indicators`, `view_diagnostic_divergences`, `run_internal_meetings`.
- Nova tabela `access_audit` — histórico de mudanças de papel, cargo, escopo, alçadas e status (quem, quando, antes, depois, justificativa). Desativar usuário nunca apaga histórico.
- `role_capabilities` ganha as linhas dos dois papéis novos.
- Pesos do diagnóstico: `product_version_config` (ou tabela de config por contrato) guarda os pesos dos 4 grupos, padrão 40/30/20/10.

## 3. Matriz de permissões (resumo)

| Recurso | Responsável principal | Demais responsáveis | Líder | Equipe |
|---|---|---|---|---|
| Visão completa da empresa | sim | sim | apenas escopo | leitura mínima |
| Contratos e produtos contratados | sim | sim | não (salvo alçada) | não |
| Valores/condições comerciais | sim | conforme alçada | não | não |
| Responder diagnóstico | sim | sim | sim | sim |
| Divergências do diagnóstico | sim | conforme alçada | conforme alçada | não |
| Top 5, metas, indicadores | sim | sim | apenas escopo | leitura do escopo |
| Aceitar responsabilidade / progresso / evidência | sim | sim | sim (escopo) | não |
| Atribuir responsáveis internos | sim | conforme alçada | conforme alçada | não |
| Atualizar indicadores | sim | conforme alçada | conforme alçada | não |
| Convidar participantes | conforme alçada | conforme alçada | conforme alçada | não |
| Sala de Guerra | sim | sim | quando convidado | não |
| Catálogo, configurações globais, administração | não | não | não | não |

Governança inalterada: Consultor 4X valida diagnóstico, aprova Metas 4X, confirma Top 5 e aprova o Resumo de Ação; Estrategista acompanha e valida execução; IA apenas propõe.

## 4. Políticas RLS necessárias

Novas funções `security definer` (padrão das existentes `is_staff`/`is_company_member`):
- `company_access_role(_user_id, _company_id, _contract_id)` — papel efetivo no contexto;
- `has_grant(_user_id, _company_id, _grant)` — alçada adicional;
- `in_scope(_user_id, _company_id, _scope_type, _scope_ref)` — escopo do Líder;
- `is_company_responsible(_user_id, _company_id)`.

Aplicação:
- `company_access`, `access_scopes`, `access_grants`: leitura pelo próprio usuário e pelo Responsável/staff da mesma empresa; escrita por staff ou Responsável com alçada `invite_members`; `access_audit` é somente leitura (insert por trigger).
- Tabelas existentes (`goals`, `tasks`, `bottlenecks`, `pillar_scores`, `meetings`, `weekly_reviews`, `reports`, `contracts`) recebem políticas **adicionais** que restringem o Líder ao escopo e escondem contrato/valores; as políticas atuais de staff e de membro seguem intactas.
- Todo bloqueio cross-company é mantido por `company_id` em todas as políticas novas; GRANTs explícitos em cada tabela criada.

## 5. Migração dos usuários atuais

- Criar `company_access` a partir de `company_members` preservando os vínculos: `cliente_dono` → `company_responsible` (marcado como principal quando `is_primary`), `gestor_cliente` → `company_leader`, `colaborador_cliente` → equipe, staff mantém papel.
- Nenhuma linha de `company_members`, `user_roles` ou contrato é removida — `company_members` continua sendo a fonte de "é membro" e é atualizada junto.
- Registrar a conversão em `access_audit`.
- Respostas de diagnóstico antigas (3 grupos) continuam legíveis: `dono_socio` → Responsável, `gestor` → Líder, `equipe` → Equipe.

## 6. Telas afetadas

- **Gerenciar Usuários**: formulário passa a pedir papel de acesso + cargo + departamento + empresa/contrato + Responsável principal, com abas de escopo e alçadas; lista mostra papel, cargo e escopo.
- **Empresas**: bloco de participantes com Responsável principal destacado.
- **Diagnóstico (Coleta)**: 4 grupos (Responsável principal, demais responsáveis, líderes, equipe), pesos configuráveis exibidos, cobertura por grupo, divergências sempre visíveis ao lado da média.
- **Metas, Tarefas, Gargalos, Indicadores, Sala de Guerra, Relatórios**: filtragem por escopo e ocultação de dados financeiros/contratuais para o Líder.
- Sem redesenho visual; nenhum outro módulo é alterado.

## 7. Critérios de teste

- Responsável principal único por contrato (segunda marcação é rejeitada).
- Líder sem escopo não lê metas de outra área; com escopo por pilar lê só aquele pilar.
- Líder não acessa valores contratuais nem condições comerciais, mesmo chamando a API direto.
- Usuário de outra empresa recebe zero linhas em todas as tabelas.
- Desativar vínculo remove acesso e preserva histórico e evidências.
- Diagnóstico com um grupo ausente redistribui pesos proporcionalmente e a soma fecha em 100%.
- Divergência acima do limite gera alerta de validação para o Consultor.
- Papéis legados continuam entrando e vendo o que já viam.

## Detalhes técnicos

Migrações aditivas (`ALTER TYPE ... ADD VALUE` em transação separada dos usos), nenhuma migração antiga editada. Camada de aplicação: `src/lib/access.ts` (matriz de permissões, cargos, escopos, alçadas), extensão de `src/hooks/useAuth.tsx` e `useCompany`/`useContract` com o vínculo efetivo, `ProtectedRoute` aceitando capacidade além de papel, e ajustes de pesos em `src/lib/see4x.ts` com testes em `src/test/see4x.test.ts`. Edge functions (`admin-list-users`, `admin-invite`, `diagnostic-response`, `socio-tools`, `mcp`) passam a considerar papel, escopo e alçadas.

Ordem de execução: banco e funções → migração dos vínculos → camada de acesso no app → telas de cadastro → escopo nas telas operacionais → diagnóstico em 4 grupos → testes.
