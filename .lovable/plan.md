# Empresa de teste completa com Roberta como SuperAdmin

Criar um ambiente de demonstração navegável: uma empresa fictícia com contratação ativa, diagnóstico validado, Top 5, metas, tarefas, reuniões, ata e progresso — tudo vinculado à conta `roberta@rc360.vip`, que já é SuperAdmin confirmado.

## Situação atual verificada

- `roberta@rc360.vip` existe, está confirmada e já possui o papel `super_admin`; já é membro de 2 empresas (`Empresa Demo 4X` e `RC360`). Nenhuma mudança de papel é necessária.
- Não existe nenhum produto, versão de produto nem contratação cadastrados (`products`, `product_versions`, `contracts` estão vazios). Sem isso, as telas com escopo de contratação ficam sem dados.
- Não existe nenhum curso cadastrado (`courses` vazio), então a Universidade 4X aparece vazia.

## O que será criado

Nova empresa **Nexo Indústria (Teste)** — nome com sufixo "(Teste)" para nunca ser confundida com cliente real — e, dentro dela:

- Produto **Mentoria SEE_4X** com a versão **SEE_4X 2026** (6 ciclos, 180 dias) e template de onboarding.
- Contratação ativa da empresa nessa versão, em Ciclo 2, com prazo de acesso e itens de onboarding materializados (etapas, encontros e entregáveis, parte concluída).
- Roberta vinculada como membro principal (mentor) da empresa.
- Diagnóstico SEE_4X validado com respostas de Dono, Gestor e Equipe, gerando Improviso, IDD, maturidade, pilar e BlindSpot prioritários.
- Scores dos 4 Pilares em duas medições (para o Radar e o comparativo antes/depois).
- Top 5 Gargalos com posição, causa raiz, resultado esperado, prazo, capacidade e progresso variado.
- 5 metas do ciclo (incluindo 2 críticas aprovadas e 1 pendente de aprovação), com atualizações no feed.
- Tarefas com prioridade e checklist parcialmente concluído.
- Reuniões: Sala de Guerra recorrente, uma realizada com gravação e presença registrada, uma futura agendada.
- Duas atas semanais: uma aprovada e uma em revisão.
- Registro de ciclo aberto e checklist de fase parcialmente preenchido.
- Um curso da Universidade 4X com 3 aulas e progresso parcial de Roberta.

Nada das duas empresas já existentes será alterado ou removido.

## Detalhes técnicos

- Toda a carga usa a ferramenta de dados (INSERT), sem migrations — o schema já suporta tudo.
- Como a execução é sem sessão (`auth.uid()` nulo), os `created_by`/`approved_by` recebem explicitamente o UUID de Roberta, e as metas críticas entram já com `approval_status` definido para não bater nos gatilhos de governança.
- IDs fixos e legíveis (prefixo `dddddddd-…`) para permitir remoção limpa depois.
- `contract_id` preenchido em todos os registros operacionais, respeitando os gatilhos de coerência empresa/contratação.
- Itens de onboarding e reuniões usam datas relativas a hoje, para a agenda de 21 dias e os alertas diários mostrarem conteúdo.
- Ao final, informo como localizar e como apagar a empresa de teste em um passo, se desejado.

## Fora de escopo

- Não publicar o projeto.
- Não criar novos usuários de login nem enviar convites (os participantes fictícios entram apenas como nomes em presença/respostas).
- Não alterar dados das empresas reais existentes.
