
# Cadastro de empresas (CRUD na Área do Mentor)

Hoje só dá para cadastrar empresa via banco — não existe tela. Vou adicionar um CRUD completo de empresas, acessível apenas para staff (`super_admin`, `mentor`, `estrategista`), com vínculo automático do criador como mentor responsável.

## O que vou fazer

### 1. Nova página `/empresas` (Admin → Empresas)
Tela de listagem + cadastro, no mesmo padrão visual do `AdminUsers`.

**Listagem (tabela):**
- Nome, segmento, estágio da jornada, nível de caos, score, data de início, ações
- Filtros: busca por nome, filtro por estágio e por nível de caos
- Badge colorido para `chaos_level` e `journey_stage`

**Botão "Nova empresa" → Dialog:**
- Nome (obrigatório)
- Segmento
- Estágio da jornada (`mes_1` … `mes_4`) — default `mes_1`
- Nível de caos (`leve`, `moderado`, `severo`, `total`) — default `moderado`
- Receita projetada (R$)
- Data de início (default hoje)
- Previsão de conclusão
- Observações
- Upload de logo (bucket `avatars`, opcional)

Ao salvar:
1. `INSERT` em `companies`
2. `INSERT` em `company_members` vinculando o usuário atual como `mentor` da empresa (`is_primary = true` se for a primeira empresa do usuário)
3. Toast de sucesso e refresh da lista + do `useCompany`

**Ações na linha:**
- **Editar** → mesmo Dialog em modo edição
- **Definir como ativa** → chama `setCurrentId` do contexto e troca a empresa do header
- **Arquivar** (soft) — não vou implementar agora porque a tabela não tem coluna `archived_at`; deixo só Editar + Definir ativa

### 2. Atalhos de acesso
- Adicionar item **"Empresas"** no menu lateral em `AppLayout.tsx`, dentro do bloco "Operação" (visível só para staff), com ícone `Building2`
- Adicionar botão **"Cadastrar empresa"** no topo da `MentorArea.tsx` que leva para `/empresas`
- Adicionar botão **"+ Nova empresa"** dentro do Select de empresas no header (`AppLayout.tsx`) quando o usuário for staff — atalho rápido

### 3. Rota
- Registrar `/empresas` em `App.tsx` dentro do `ProtectedRoute` com guard de `isStaff`
- Reutilizar o componente `ProtectedRoute` (passar prop `staffOnly` se já existir; caso não, adicionar)

### 4. Atualizações no contexto
- Após criar empresa, chamar `refresh()` do `useCompany` para a nova empresa aparecer no Select do header imediatamente
- Se for a primeira empresa do usuário, marcar como ativa automaticamente

## Regras de segurança
- RLS já existe e cobre tudo: `companies_staff_modify` (ALL, `is_staff(auth.uid())`) e `members_staff_modify` (ALL, `is_staff(auth.uid())`)
- Validação no front com zod (nome mínimo 2 caracteres, números não negativos)
- Não preciso de migration nem edge function — operação direta via SDK

## Arquivos tocados
- `src/pages/AdminCompanies.tsx` — novo, CRUD completo
- `src/App.tsx` — registrar rota `/empresas`
- `src/components/AppLayout.tsx` — item de menu + atalho no Select
- `src/pages/MentorArea.tsx` — botão "Cadastrar empresa"
- `src/components/ProtectedRoute.tsx` — adicionar guard `staffOnly` se ainda não houver
