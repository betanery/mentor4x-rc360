-- Mentor 4X — hardening de autorização contextual para Edge Functions com service_role.
-- Objetivo: evitar que service_role transforme staff ou membro em acesso global acidental.

CREATE OR REPLACE FUNCTION public.actor_company_permissions(_user_id uuid, _company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  roles text[] := ARRAY[]::text[];
  is_super boolean := false;
  is_mentor boolean := false;
  is_strategist boolean := false;
  assigned boolean := false;
  active_access boolean := false;
  responsible boolean := false;
  leader boolean := false;
  client_owner boolean := false;
  full_scope boolean := false;
  can_commercial boolean := false;
  can_reports boolean := false;
  pillar_scopes text[] := ARRAY[]::text[];
  department_scopes text[] := ARRAY[]::text[];
BEGIN
  SELECT COALESCE(array_agg(ur.role::text), ARRAY[]::text[])
    INTO roles
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id;

  is_super := 'super_admin' = ANY(roles);
  is_mentor := 'mentor' = ANY(roles);
  is_strategist := 'estrategista' = ANY(roles);

  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = _user_id AND cm.company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.company_access ca
    WHERE ca.user_id = _user_id
      AND ca.company_id = _company_id
      AND ca.status = 'ativo'
      AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
  ) INTO assigned;

  SELECT EXISTS (
    SELECT 1 FROM public.company_access ca
    WHERE ca.user_id = _user_id AND ca.company_id = _company_id
      AND ca.status = 'ativo'
      AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
  ) INTO active_access;

  SELECT EXISTS (
    SELECT 1 FROM public.company_access ca
    WHERE ca.user_id = _user_id AND ca.company_id = _company_id
      AND ca.status = 'ativo'
      AND ca.access_role IN ('company_responsible')
      AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
  ) INTO responsible;

  SELECT EXISTS (
    SELECT 1 FROM public.company_access ca
    WHERE ca.user_id = _user_id AND ca.company_id = _company_id
      AND ca.status = 'ativo'
      AND ca.access_role = 'cliente_dono'
      AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
  ) INTO client_owner;

  SELECT EXISTS (
    SELECT 1 FROM public.company_access ca
    WHERE ca.user_id = _user_id AND ca.company_id = _company_id
      AND ca.status = 'ativo'
      AND ca.access_role = 'company_leader'
      AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
  ) AND NOT responsible AND NOT client_owner INTO leader;

  SELECT COALESCE(array_agg(DISTINCT s.scope_ref) FILTER (WHERE s.scope_type = 'pilar' AND s.scope_ref IS NOT NULL), ARRAY[]::text[]),
         COALESCE(array_agg(DISTINCT s.scope_ref) FILTER (WHERE s.scope_type = 'departamento' AND s.scope_ref IS NOT NULL), ARRAY[]::text[])
    INTO pillar_scopes, department_scopes
  FROM public.access_scopes s
  JOIN public.company_access ca ON ca.id = s.access_id
  WHERE ca.user_id = _user_id
    AND ca.company_id = _company_id
    AND ca.status = 'ativo'
    AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE);

  full_scope := is_super
    OR ((is_mentor OR is_strategist) AND assigned)
    OR responsible
    OR client_owner
    OR (active_access AND NOT leader)
    OR EXISTS (
      SELECT 1 FROM public.access_scopes s
      JOIN public.company_access ca ON ca.id = s.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id
        AND ca.status = 'ativo'
        AND s.scope_type = 'empresa'
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
    );

  can_commercial := is_super
    OR (is_mentor AND assigned)
    OR responsible
    OR client_owner
    OR EXISTS (
      SELECT 1 FROM public.access_grants g
      JOIN public.company_access ca ON ca.id = g.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id
        AND ca.status = 'ativo'
        AND g.grant_key = 'view_commercial_terms'
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
    );

  can_reports := is_super
    OR (is_mentor AND assigned)
    OR responsible
    OR client_owner
    OR EXISTS (
      SELECT 1 FROM public.access_grants g
      JOIN public.company_access ca ON ca.id = g.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id
        AND ca.status = 'ativo'
        AND g.grant_key = 'view_full_reports'
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
    );

  RETURN jsonb_build_object(
    'allowed', is_super OR assigned,
    'is_super_admin', is_super,
    'is_staff', is_super OR ((is_mentor OR is_strategist) AND assigned),
    'is_consultor', is_super OR (is_mentor AND assigned),
    'is_strategist', is_strategist AND assigned,
    'is_responsible', responsible,
    'is_leader', leader,
    'full_scope', full_scope,
    'can_view_commercial', can_commercial,
    'can_view_full_reports', can_reports,
    'pillar_scopes', to_jsonb(pillar_scopes),
    'department_scopes', to_jsonb(department_scopes)
  );
END $$;

REVOKE ALL ON FUNCTION public.actor_company_permissions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.actor_company_permissions(uuid, uuid) TO service_role;

-- Corrige as funções públicas existentes para que service_role não signifique "sempre true".
-- Elas continuam seguras para chamadas normais do usuário e as Edge Functions passam a usar
-- actor_company_permissions quando operam com service_role.
CREATE OR REPLACE FUNCTION public.in_scope(_user_id uuid, _company_id uuid, _pillar text DEFAULT NULL, _department text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN current_setting('request.jwt.claim.role', true) <> 'service_role' AND _user_id <> auth.uid() THEN false
    WHEN NOT public.is_company_leader(_user_id, _company_id) THEN public.is_company_member(_user_id, _company_id) OR public.has_role(_user_id, 'super_admin')
    ELSE EXISTS (
      SELECT 1 FROM public.access_scopes s
      JOIN public.company_access ca ON ca.id = s.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
        AND (
          s.scope_type = 'empresa'
          OR (s.scope_type = 'pilar' AND _pillar IS NOT NULL AND s.scope_ref = _pillar)
          OR (s.scope_type = 'departamento' AND _department IS NOT NULL AND s.scope_ref = _department)
        )
    ) END
$$;

CREATE OR REPLACE FUNCTION public.can_view_commercial(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN current_setting('request.jwt.claim.role', true) <> 'service_role' AND _user_id <> auth.uid() THEN false
    WHEN public.has_role(_user_id, 'super_admin') THEN true
    WHEN NOT public.is_company_member(_user_id, _company_id) THEN false
    WHEN NOT public.is_company_leader(_user_id, _company_id) THEN true
    ELSE public.has_grant(_user_id, _company_id, 'view_commercial_terms')
  END
$$;
