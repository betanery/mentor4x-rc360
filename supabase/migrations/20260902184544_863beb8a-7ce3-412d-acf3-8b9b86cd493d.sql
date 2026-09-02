-- 1. Novo grupo de respondente do diagnóstico
ALTER TYPE public.respondent_group ADD VALUE IF NOT EXISTS 'responsavel_principal';

-- 2. Vínculo contextual usuário x empresa x contratação
CREATE TABLE public.company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  access_role public.app_role NOT NULL,
  job_title_code text NOT NULL DEFAULT 'outro',
  job_title_other text,
  department text,
  is_primary_responsible boolean NOT NULL DEFAULT false,
  diagnostic_group text,
  diagnostic_weight numeric,
  status text NOT NULL DEFAULT 'ativo',
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  invited_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_access_status_check CHECK (status IN ('ativo','suspenso','encerrado')),
  CONSTRAINT company_access_job_title_check CHECK (job_title_code IN ('dono','socio','ceo','diretor','gerente','coordenador','supervisor','outro')),
  CONSTRAINT company_access_group_check CHECK (diagnostic_group IS NULL OR diagnostic_group IN ('responsavel_principal','dono_socio','gestor','equipe'))
);

CREATE UNIQUE INDEX company_access_unique_ctx
  ON public.company_access (user_id, company_id, COALESCE(contract_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX company_access_one_primary_per_contract
  ON public.company_access (contract_id)
  WHERE is_primary_responsible AND status = 'ativo' AND contract_id IS NOT NULL;
CREATE UNIQUE INDEX company_access_one_primary_per_company
  ON public.company_access (company_id)
  WHERE is_primary_responsible AND status = 'ativo' AND contract_id IS NULL;
CREATE INDEX company_access_company_idx ON public.company_access (company_id, status);
CREATE INDEX company_access_user_idx ON public.company_access (user_id, status);

CREATE TRIGGER trg_company_access_updated BEFORE UPDATE ON public.company_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER company_access_contract_company_match BEFORE INSERT OR UPDATE ON public.company_access
FOR EACH ROW EXECUTE FUNCTION public.ensure_contract_matches_company();

-- 3. Escopos de acesso
CREATE TABLE public.access_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.company_access(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_ref text,
  scope_label text,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_scopes_type_check CHECK (scope_type IN ('empresa','pilar','departamento','etapa','meta','indicador','documento'))
);
CREATE INDEX access_scopes_access_idx ON public.access_scopes (access_id);

-- 4. Alçadas adicionais
CREATE TABLE public.access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.company_access(id) ON DELETE CASCADE,
  grant_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_grants_key_check CHECK (grant_key IN (
    'invite_members','view_financials','view_commercial_terms','assign_owners',
    'validate_evidence','update_indicators','view_diagnostic_divergences','run_internal_meetings')),
  CONSTRAINT access_grants_unique UNIQUE (access_id, grant_key)
);

-- 5. Auditoria de acesso
CREATE TABLE public.access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_id uuid,
  target_user_id uuid,
  actor_id uuid,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  justification text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_audit_company_idx ON public.access_audit (company_id, created_at DESC);

-- 6. Pesos configuráveis dos 4 grupos do diagnóstico
ALTER TABLE public.product_version_config
  ADD COLUMN IF NOT EXISTS diagnostic_weights jsonb NOT NULL
  DEFAULT '{"responsavel_principal":0.40,"dono_socio":0.30,"gestor":0.20,"equipe":0.10}'::jsonb;
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS diagnostic_weights jsonb;

-- 7. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_access TO authenticated;
GRANT ALL ON public.company_access TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_scopes TO authenticated;
GRANT ALL ON public.access_scopes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_grants TO authenticated;
GRANT ALL ON public.access_grants TO service_role;
GRANT SELECT, INSERT ON public.access_audit TO authenticated;
GRANT ALL ON public.access_audit TO service_role;

ALTER TABLE public.company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_audit ENABLE ROW LEVEL SECURITY;

-- 8. Funções auxiliares de acesso
CREATE OR REPLACE FUNCTION public.is_company_responsible(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (
      SELECT 1 FROM public.company_access ca
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id
        AND ca.status = 'ativo' AND ca.access_role = 'company_responsible'
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.company_access_role(_user_id uuid, _company_id uuid, _contract_id uuid DEFAULT NULL)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN (
      SELECT ca.access_role::text FROM public.company_access ca
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id
        AND ca.status = 'ativo'
        AND (ca.contract_id IS NULL OR _contract_id IS NULL OR ca.contract_id = _contract_id)
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
      ORDER BY ca.is_primary_responsible DESC,
        CASE ca.access_role::text
          WHEN 'company_responsible' THEN 1 WHEN 'cliente_dono' THEN 2
          WHEN 'company_leader' THEN 3 WHEN 'gestor_cliente' THEN 4 ELSE 5 END
      LIMIT 1
    )
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.has_grant(_user_id uuid, _company_id uuid, _grant text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (
      SELECT 1 FROM public.access_grants g
      JOIN public.company_access ca ON ca.id = g.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id
        AND ca.status = 'ativo' AND g.grant_key = _grant
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.is_company_leader(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN (
      NOT public.is_staff(_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.company_access ca
        WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
          AND ca.access_role IN ('company_responsible','cliente_dono')
      )
      AND EXISTS (
        SELECT 1 FROM public.company_access ca
        WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
          AND ca.access_role = 'company_leader'
          AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
      )
    )
    ELSE false
  END
$$;

-- Escopo: filtra apenas linhas que carregam pilar/departamento.
CREATE OR REPLACE FUNCTION public.in_scope(_user_id uuid, _company_id uuid, _pillar text DEFAULT NULL, _department text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.role', true) = 'service_role' THEN true
    WHEN _user_id IS NULL OR _user_id <> auth.uid() THEN false
    WHEN NOT public.is_company_leader(_user_id, _company_id) THEN true
    WHEN _pillar IS NULL AND _department IS NULL THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.access_scopes s
      JOIN public.company_access ca ON ca.id = s.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.access_scopes s
      JOIN public.company_access ca ON ca.id = s.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
        AND (
          s.scope_type = 'empresa'
          OR (s.scope_type = 'pilar' AND _pillar IS NOT NULL AND s.scope_ref = _pillar)
          OR (s.scope_type = 'departamento' AND _department IS NOT NULL AND s.scope_ref = _department)
        )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.can_view_commercial(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.role', true) = 'service_role' THEN true
    WHEN _user_id IS NULL OR _user_id <> auth.uid() THEN false
    WHEN NOT public.is_company_leader(_user_id, _company_id) THEN true
    ELSE public.has_grant(_user_id, _company_id, 'view_commercial_terms')
  END
$$;

-- 9. Políticas das novas tabelas
CREATE POLICY "company_access_select" ON public.company_access FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR user_id = auth.uid() OR public.is_company_responsible(auth.uid(), company_id));

CREATE POLICY "company_access_write_staff" ON public.company_access FOR ALL TO authenticated
USING (public.is_staff(auth.uid()) OR (public.is_company_responsible(auth.uid(), company_id) AND public.has_grant(auth.uid(), company_id, 'invite_members')))
WITH CHECK (public.is_staff(auth.uid()) OR (public.is_company_responsible(auth.uid(), company_id) AND public.has_grant(auth.uid(), company_id, 'invite_members')));

CREATE POLICY "access_scopes_select" ON public.access_scopes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_access ca WHERE ca.id = access_id
  AND (public.is_staff(auth.uid()) OR ca.user_id = auth.uid() OR public.is_company_responsible(auth.uid(), ca.company_id))));

CREATE POLICY "access_scopes_write" ON public.access_scopes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_access ca WHERE ca.id = access_id
  AND (public.is_staff(auth.uid()) OR (public.is_company_responsible(auth.uid(), ca.company_id) AND public.has_grant(auth.uid(), ca.company_id, 'invite_members')))))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_access ca WHERE ca.id = access_id
  AND (public.is_staff(auth.uid()) OR (public.is_company_responsible(auth.uid(), ca.company_id) AND public.has_grant(auth.uid(), ca.company_id, 'invite_members')))));

CREATE POLICY "access_grants_select" ON public.access_grants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_access ca WHERE ca.id = access_id
  AND (public.is_staff(auth.uid()) OR ca.user_id = auth.uid() OR public.is_company_responsible(auth.uid(), ca.company_id))));

CREATE POLICY "access_grants_write" ON public.access_grants FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_access ca WHERE ca.id = access_id
  AND (public.is_staff(auth.uid()) OR (public.is_company_responsible(auth.uid(), ca.company_id) AND public.has_grant(auth.uid(), ca.company_id, 'invite_members')))))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_access ca WHERE ca.id = access_id
  AND (public.is_staff(auth.uid()) OR (public.is_company_responsible(auth.uid(), ca.company_id) AND public.has_grant(auth.uid(), ca.company_id, 'invite_members')))));

CREATE POLICY "access_audit_select" ON public.access_audit FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_company_responsible(auth.uid(), company_id));

CREATE POLICY "access_audit_insert" ON public.access_audit FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_responsible(auth.uid(), company_id));

-- 10. Trigger de auditoria dos vínculos
CREATE OR REPLACE FUNCTION public.log_company_access_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.access_audit (company_id, access_id, target_user_id, actor_id, action, previous_value)
    VALUES (OLD.company_id, OLD.id, OLD.user_id, auth.uid(), 'acesso_removido', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.access_audit (company_id, access_id, target_user_id, actor_id, action, new_value)
    VALUES (NEW.company_id, NEW.id, NEW.user_id, auth.uid(), 'acesso_criado', to_jsonb(NEW));
    RETURN NEW;
  ELSE
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      INSERT INTO public.access_audit (company_id, access_id, target_user_id, actor_id, action, previous_value, new_value)
      VALUES (NEW.company_id, NEW.id, NEW.user_id, auth.uid(), 'acesso_alterado', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_log_company_access AFTER INSERT OR UPDATE OR DELETE ON public.company_access
FOR EACH ROW EXECUTE FUNCTION public.log_company_access_change();

-- 11. Políticas restritivas de escopo nas tabelas operacionais
CREATE POLICY "leader_scope_goals" ON public.goals AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.in_scope(auth.uid(), company_id, pillar::text, NULL));

CREATE POLICY "leader_scope_bottlenecks" ON public.bottlenecks AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.in_scope(auth.uid(), company_id, NULL, area));

CREATE POLICY "leader_scope_pillar_scores" ON public.pillar_scores AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.in_scope(auth.uid(), company_id, pillar::text, NULL));

CREATE POLICY "leader_scope_tasks" ON public.tasks AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.in_scope(auth.uid(), company_id,
  (SELECT g.pillar::text FROM public.goals g WHERE g.id = tasks.goal_id), NULL));

CREATE POLICY "leader_commercial_contracts" ON public.contracts AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_view_commercial(auth.uid(), company_id));

CREATE POLICY "leader_commercial_reports" ON public.reports AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_view_commercial(auth.uid(), company_id));