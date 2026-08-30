# Diagnóstico 4X: textos claros + coleta por link, e-mail e entrevista

## Problema atual

Na página `/diagnostico`, cada pergunta mostra o **nome do BlindSpot** (negativo, ex. "Oferta indefinida") como título e a **afirmação positiva** ("A oferta principal é clara…") como legenda. Isso inverte o sentido da leitura e confunde quem responde. A escala também aparece colada ("1 · Não existe2 · Existe informalmente…") por não ter separação visual nem legenda única.

Hoje só quem tem login e pertence à empresa consegue responder o diagnóstico do cliente. Não existe link para o cliente responder, nem modo entrevista, nem controle de quem já respondeu.

## Parte 1 — Clareza dos textos (sem mudar o cálculo)

- A pergunta passa a ser a **afirmação positiva** em destaque; o BlindSpot vira uma etiqueta discreta (`BS-C1 · Oferta indefinida`) visível para consultor/estrategista e oculta para o cliente respondente (evita sugestionar a resposta).
- Enunciado padrão no topo de cada bloco: "Marque o quanto cada afirmação já é verdade hoje na empresa".
- Escala em botões separados, com número grande e rótulo abaixo, mais uma legenda única por bloco:
  1 Não existe · 2 Existe informalmente · 3 Existe em parte · 4 Estruturado · 5 Estruturado e medido.
- Revisão de redação das 20 afirmações de BlindSpot, 8 dimensões de IDD e 8 dimensões de Maturidade para ficarem todas na mesma voz (afirmação positiva, presente, sem jargão).
- Os mesmos textos e a mesma escala passam a valer também no diagnóstico público de captação (`/diagnostico-lead`), que hoje usa a mesma fonte de dados.

## Parte 2 — Formas de responder

Três caminhos, todos gravando em `diagnostic_responses` e entrando no cálculo com os pesos oficiais (Dono 40% / Gestor 35% / Equipe 25%):

1. **Link geral da empresa** — um link por diagnóstico, para distribuir em massa. Quem abre informa nome, cargo e grupo, e responde.
2. **Convite individual** — o consultor cadastra nome, e-mail, cargo e grupo; a plataforma gera um link exclusivo, envia por e-mail com a marca MENTOR 4X e mostra o status (enviado / respondido / expirado) com botão de reenviar e copiar link.
3. **Modo entrevista** — o consultor responde junto com a pessoa dentro da plataforma, informando quem está sendo entrevistado (nome, cargo, grupo). A resposta fica marcada como coletada em entrevista, com o nome do entrevistador registrado para auditoria.

Nova aba "Coleta" no diagnóstico, visível para consultor/estrategista, com: link geral (copiar / WhatsApp / QR), lista de convidados com status, botão "Registrar entrevista" e painel de cobertura ("faltam 2 gestores", divergência entre grupos).

## Parte 3 — Diagnóstico de captação (leads)

O diagnóstico público já existe e funciona hoje em:

- `/diagnostico-lead` — formulário completo, com consentimento LGPD, autosave, retomada por token, captura de UTM e recomendação de trilha no final;
- os leads chegam na área do Estrategista para acompanhamento e conversão em empresa.

O que falta para você conseguir distribuir de verdade:

- Página final com CTA claro para conversa e o resultado resumido em linguagem de dono.
- Área "Captação" com o link público pronto para copiar, gerador de link com UTM por campanha (Instagram, indicação, e-mail, evento) e QR code.
- Lista de leads com filtros por origem, Improviso e trilha recomendada, e botão de converter em empresa/contrato.

## Detalhes técnicos

- `src/lib/see4x.ts`: revisão dos textos de `BLINDSPOTS.statement`, `IDD_DIMENSIONS`, `MATURITY_DIMENSIONS` e `ANSWER_SCALE` (rótulos e descrição curta). Códigos e pesos não mudam, para não invalidar diagnósticos existentes.
- `QuestionRow` em `Diagnostic.tsx` reescrito (afirmação em destaque, etiqueta opcional do BlindSpot, escala com legenda) e componente compartilhado com `LeadDiagnostic.tsx`.
- Migration aditiva: tabela `diagnostic_invites` (diagnostic_id, company_id, contract_id, nome, e-mail, cargo, grupo, token, status, enviado/respondido em, convidado por) + colunas em `diagnostic_responses` para `respondent_role`, `collection_method` (`self` | `link` | `entrevista`) e `interviewer_user_id`. RLS: staff e membros da empresa leem/gerenciam; tokens nunca expostos por API pública. GRANT explícito para `authenticated` e `service_role`.
- Nova Edge Function `diagnostic-response` (pública, sem JWT) com validação zod, rate limit por IP no mesmo padrão de `lead-diagnostic`: resolve token (geral ou individual), retorna só o mínimo (nome da empresa, cargo pré-preenchido, perguntas), grava a resposta via service role e marca o convite como respondido. Nunca aceita `company_id`/`diagnostic_id` vindos do cliente.
- Rota pública nova `/responder/:token` (fora do `ProtectedRoute`), reaproveitando o layout do diagnóstico de lead.
- E-mail do convite: exige domínio de e-mail configurado no projeto. Vou preparar o template com a marca MENTOR 4X e a infraestrutura de envio; se o domínio ainda não estiver verificado, os links de copiar/WhatsApp funcionam desde o primeiro dia e o envio automático liga sozinho quando o DNS verificar.
- Nada de publicar o projeto nem alterar dados reais existentes; migrations apenas aditivas.

## Ordem de execução

1. Textos e escala (correção imediata do que está confuso, cliente e lead).
2. Migration + Edge Function + rota pública de resposta.
3. Aba Coleta: link geral, convites individuais, modo entrevista, cobertura.
4. E-mail de convite com marca e reenvio.
5. Área de Captação: links com UTM, QR e lista de leads.
