# Bloco 1 — Nomenclatura SEE_4X e marca RC360

Alinhar o vocabulário e a identidade do sistema ao Guia SEE_4X, **sem remover funcionalidade e sem perder dados**. Nada de reconstrução: só renomeação, migração compatível de enums e ajuste de marca.

## O que muda para o usuário

### 1. Jornada: 4 meses → 6 ciclos
- "Jornada 4 Meses" passa a "Jornada SEE_4X — 6 Ciclos".
- Estágios `Mês 1–4` viram `Ciclo 1–6`, com os focos oficiais: 1 Clareza e Prioridade, 2 Organização e Execução, 3 Estruturação, 4 Fortalecimento, 5 Performance, 6 Autonomia.
- Cada ciclo exibe a saída principal esperada. O checklist já existente é preservado e remapeado (Mês 1→Ciclo 1, Mês 2→Ciclo 2, Mês 3→Ciclo 4, Mês 4→Ciclo 6), mantendo o histórico.
- Os cinco Motores (Clareza → Prioridade → Execução → Governança → Autonomia) aparecem como faixa cumulativa na Jornada e no Dashboard.

### 2. Fim do "caos" → Improviso
- "Nível de caos" passa a "Nível de Improviso"; os selos ficam "Improviso Total / Severo / Moderado / Leve / Em Escala".
- Onde hoje se lê "Mapa de caos", passa a "Mapa de Improviso".
- Regra de independência respeitada: Improviso continua um campo próprio, nunca calculado como inverso de outra variável.

### 3. Papéis e rituais
- "Área do Mentor" → "Área do Consultor 4X"; "Mentor" → "Consultor 4X"; "Mentorado" → "Cliente 4X".
- "Comentário do mentor" nas metas → "Parecer do Consultor 4X".
- Sala de Guerra passa a ser identificada como **quinzenal**, e o tipo de reunião "Mentoria" vira "Check-in semanal" — dois rituais distintos na tela da Sala de Guerra.
- Universidade/Playbooks passam a ser descritos como "recursos de apoio do SEE_4X" (não "conteúdo da mentoria").

### 4. Marca
- Plataforma continua chamada **Mentor 4X**; metodologia é **SEE_4X**; assinatura institucional **RC360 / Roberta Cardoso** no login, rodapé e relatórios/certificados em PDF.
- Dourado ajustado para o oficial #C18A09 e reservado a prioridade, progresso e decisão (mantendo azul-marinho #112145 e azul #124378 já existentes).
- Título e descrição do site, textos de login e do certificado reescritos sem "caos", "4 meses", "mentoria" ou "mentorado".

## Detalhes técnicos

**Banco (migração compatível, sem perda de dados)**
- `journey_stage`: adicionar valores `ciclo_1..ciclo_6` ao enum, migrar as linhas existentes (`mes_1→ciclo_1`, `mes_2→ciclo_2`, `mes_3→ciclo_4`, `mes_4→ciclo_6`, `concluido` mantido) e atualizar `journey_checklist.stage`. Os valores antigos permanecem no tipo para não quebrar nada — apenas saem da UI.
- `chaos_level`: enum mantido (rótulos passam a Improviso) para não invalidar dados; a renomeação é de apresentação. Opcionalmente adiciono a coluna `maturity_level` na tabela `companies` só se o Bloco 2 for aprovado — fora do escopo aqui.
- `meeting_type`: adicionar `checkin_semanal`; `mentoria` continua aceito e é exibido com o novo rótulo.
- Sem alteração em RLS, grants ou políticas de storage: nenhuma mudança de acesso neste bloco.

**Frontend**
- `src/lib/labels.ts`: passa a ser a fonte única — `IMPROVISO_LABEL` (substituindo `CHAOS_LABEL`), `CYCLE_LABEL` com foco e saída, `MOTORES`, `ROLE_LABEL` e `MEETING_TYPE_LABEL` atualizados.
- Páginas ajustadas: `Dashboard`, `Journey`, `Goals`, `Bottlenecks`, `AdminCompanies`, `MentorArea` (rota `/mentor` mantida, título novo), `StrategistArea`, `WarRoom`, `Certificates`, `University`, `Playbooks`, `Auth`, `AppLayout` (menu), `index.html`.
- `src/index.css`: token `--gold` para #C18A09 e revisão dos gradientes que o usam.
- Textos de PDF nas edge functions de relatório/certificado alinhados ao novo vocabulário.

**Validação antes de encerrar**
- Busca final por "caos", "chaos", "mentorado", "4 meses", "Área do Mentor" na interface: zero ocorrências visíveis.
- Conferência visual do Dashboard, Jornada, Sala de Guerra e Admin Empresas em desktop e mobile, com dados atuais preservados.

## Fora deste bloco
Módulo Diagnóstico SEE_4X, Maturidade, 20 BlindSpots e 40 Capacidades, Top 5 completo, formulário ampliado da Meta 4X, alçadas/aprovações e relatório antes/depois — entram nos blocos seguintes, um por vez.
