# FASTRACK: versão configurável + aviso na tela de produtos

## Diagnóstico confirmado

As ações **Configuração**, **Onboarding**, **Duplicar** e **Publicada** aparecem por *versão do produto*, não pelo produto. Consulta ao banco:

```text
4X Master  -> 3 versões
4X Pro     -> 1 versão
4X Start   -> 1 versão
FASTRACK   -> 0 versões
```

Por isso o FASTRACK aparece "sem opções". Não é bug de permissão: falta criar a versão.

O que já é configurável hoje por versão (sem código): preço, moeda, formato, público, duração/vigência, dias de acesso, suporte, comunidade, bônus, IA, visibilidade no catálogo, links de venda/checkout, modo de recomendação, observações, além de **encontros, etapas e entregáveis** (adicionar, editar, remover, reordenar) e **onboarding** por versão.

O que a estrutura pedida ainda **não** tem campo no banco: promessa, nível da esteira, tipo de serviço, modalidade, diagnóstico obrigatório, limite de Metas Críticas, dias do Plano de Ação, regras de conclusão e campos obrigatórios da meta.

## Fase 1 — Campos de configuração faltantes (migração aditiva)

Novas colunas opcionais em `product_version_config`, todas com default seguro para não afetar versões existentes:

- `promise` (promessa), `ladder_level` (nível da esteira), `service_type` (individual/grupo), `modality` (online/presencial/híbrido)
- `diagnostic_required` (bool), `max_critical_goals` (int), `action_plan_days` (int)
- `completion_rules` (jsonb: lista de regras marcáveis), `goal_required_fields` (jsonb: campos obrigatórios da meta)

Sem alterar nenhuma coluna existente, sem apagar dados. Rollback = `DROP COLUMN` das novas colunas.

## Fase 2 — Interface de configuração ampliada

Em `VersionConfigDialog.tsx`, na aba **Comercial**, acrescentar os novos campos e uma nova aba **Regras** com:

- diagnóstico obrigatório, limite de Metas Críticas, dias do Plano de Ação
- regras de conclusão (lista editável: adicionar/remover/reordenar)
- campos obrigatórios da meta (seleção múltipla sobre os campos que já existem em `goals`)

Tudo continua bloqueado quando a versão está publicada (imutabilidade preservada) e liberado em rascunho.

## Fase 3 — Aviso claro quando o produto não tem versão

Em `AdminProducts.tsx`, trocar o texto "Nenhuma versão cadastrada." por um estado vazio explicativo: aviso de que as configurações só existem por versão, com botão destacado **Criar primeira versão**.

## Fase 4 — Template inicial do FASTRACK (dados, não código)

Criar **FASTRACK v1** em rascunho (não publicada), com jornada própria de 4 etapas — sem herdar os 6 ciclos do 4X Master:

1. Diagnóstico e preparação
2. 1º encontro — Clareza e Prioridade
3. Execução assistida
4. 2º encontro — Ajuste e Plano

Encontros: 2 online de 50 min. Entregáveis: Diagnóstico 4X proporcional, 2 encontros individuais, até 2 Metas Críticas, Plano de Ação de 30 dias, Resumo de Ação FASTRACK, recomendação de continuidade, avaliação final.

Configuração: preço R$ 997, vigência 30 dias, individual, online, categoria "Acompanhamento estratégico", nível intermediário, diagnóstico obrigatório, máximo 2 Metas Críticas, plano de 30 dias, comunidade e suporte opcionais, regras de conclusão conforme descrito.

Tudo gravado como **dados editáveis**, então o administrador pode alterar, duplicar, remover e reordenar qualquer item pela tela. Fica em rascunho até você revisar e publicar.

## Preservação e rollback

- Nenhum produto, contrato, cliente, diagnóstico, meta ou histórico é alterado.
- Só uma migração aditiva de colunas opcionais + inserção de uma versão nova.
- Rollback: excluir a versão FASTRACK v1 (nunca publicada, sem contratos) e remover as colunas novas.

## Critérios de aceite

- FASTRACK exibe versão v1 com Configuração, Onboarding, Duplicar e Publicar.
- Salvar os novos campos funciona em rascunho e fica bloqueado após publicar.
- 4X Master/Start/Pro e seus contratos continuam idênticos.
- Produto sem versão mostra aviso com botão de criar versão.
