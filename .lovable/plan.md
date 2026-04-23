
# Convite por email com seleção de role + vínculo automático

A tela `/admin/usuarios` (`AdminUsers.tsx`) já existe e chama a edge function `admin-invite`, mas a UX atual exige senha temporária e não envia email real. Vou substituir por um fluxo de convite por email de verdade.

## O que muda

### 1. Edge function `admin-invite` (reescrita)
- Remove o fluxo de `createUser` com senha.
- Passa a usar `supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name } })` — Supabase envia o email de convite com link mágico para o usuário definir a própria senha.
- Após criar o usuário convidado:
  - Insere em `user_roles` (role escolhida).
  - Se `company_id` informado → insere em `company_members` com `member_role`.
  - Se a role for de cliente (`cliente_dono`, `gestor_cliente`, `colaborador_cliente`) e nenhum `company_id` foi passado, retorna erro 400 (cliente precisa de empresa).
  - Para staff (`mentor`, `estrategista`), `company_id` é opcional.
- Mantém checagens: só staff convida; só `super_admin` cria outro `super_admin`.
- Trata caso "email já existe" com mensagem amigável.

### 2. Tela `AdminUsers.tsx` (refeita)
- **Form de convite (Dialog):**
  - Campo: Nome completo
  - Campo: Email
  - Select: Role (com labels em PT)
  - Select: Empresa — pré-preenchido automaticamente com a empresa ativa do contexto (`useCompany`); obrigatório quando role é de cliente, opcional para staff
  - Remove campo "Senha temporária"
  - Botão: "Enviar convite"
- **Feedback:** toast verde "Convite enviado para {email}. Ele receberá um link para definir a senha."
- **Lista de usuários** (mantida + melhorada):
  - Mostra nome, email (vindo de auth via lookup), roles em badges, empresas vinculadas
  - Filtro por role e por empresa
  - Ação "Reenviar convite" para usuários ainda não confirmados

### 3. Auto-vínculo à empresa do Super Admin
- O `company_id` no form vem por padrão de `useCompany().currentCompany?.id` (a empresa ativa selecionada no header).
- Super Admin pode trocar para qualquer empresa via Select; cliente_dono/gestor não chegam nessa tela (já bloqueado por `isStaff`).

### 4. Tela `/auth` — fluxo de definição de senha pós-convite
- Detecta `type=invite` ou `type=recovery` na URL (Supabase redireciona com `access_token` no hash).
- Quando detectado, mostra formulário "Defina sua senha" em vez do login.
- Ao salvar: `supabase.auth.updateUser({ password })` → redireciona para `/`.

### 5. Configuração necessária
- A URL de redirect do convite será `${window.location.origin}/auth` — precisa estar liberada nas URLs permitidas. Vou configurar `site_url` e `additional_redirect_urls` via tool de auth config para incluir o domínio de preview e produção.

## Detalhes técnicos
- A função `inviteUserByEmail` usa o template de email padrão do Supabase ("Invite user"). Não vou configurar templates customizados de marca neste passo (pode ser feito depois com setup de domínio de email).
- O `handle_new_user` trigger já cria o `profile` automaticamente quando o usuário aceita o convite e faz primeiro login, então não precisa inserir profile manualmente.
- Validação com zod no edge function (email válido, role no enum, company_id uuid quando presente).

## Arquivos tocados
- `supabase/functions/admin-invite/index.ts` — reescrito
- `src/pages/AdminUsers.tsx` — UI refeita, sem campo senha, com auto-select de empresa
- `src/pages/Auth.tsx` — adicionar modo "definir senha" para convidados
- Auth config — adicionar redirect URL
