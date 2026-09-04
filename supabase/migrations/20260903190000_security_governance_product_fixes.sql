-- Mentor 4X — correções consolidadas de segurança, governança e produtos.
-- Migração aditiva: preserva os dados e mantém compatibilidade com vínculos legados.

-- ---------------------------------------------------------------------------
-- Acesso empresarial: company_access passa a participar das funções oficiais.
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_access DROP CONSTRAINT IF EXISTS company_access_role_check;
ALTER TABLE public.company_access ADD CONSTRAINT company_access_role_check
  CHECK (access_role IN ('company_responsible','company_leader','cliente_dono','gestor_cliente','colaborador_cliente'));

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.user_id = _user_id AND cm.company_id = _company_id)
      OR EXISTS (
        SELECT 1 FROM public.company_access ca
        WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
          AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
      )
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.user_companies(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = _user_id
    UNION
    SELECT ca.company_id FROM public.company_access ca
      WHERE ca.user_id = _user_id AND ca.status = 'ativo'
        AND (ca.valid_until IS NULL OR ca.valid_until >= CURRENT_DATE)
  ) companies
  WHERE _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
$$;
REVOKE ALL ON FUNCTION public.user_companies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_companies(uuid) TO authenticated, service_role;

-- Um Líder sem escopo explícito não recebe acesso irrestrito por acidente.
CREATE OR REPLACE FUNCTION public.in_scope(_user_id uuid, _company_id uuid, _pillar text DEFAULT NULL, _department text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.role', true) = 'service_role' THEN true
    WHEN _user_id IS NULL OR _user_id <> auth.uid() THEN false
    WHEN NOT public.is_company_leader(_user_id, _company_id) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.access_scopes s
      JOIN public.company_access ca ON ca.id = s.access_id
      WHERE ca.user_id = _user_id AND ca.company_id = _company_id AND ca.status = 'ativo'
        AND (ca.contract_id IS NULL OR ca.contract_id IN (
          SELECT c.id FROM public.contracts c WHERE c.company_id = _company_id AND c.status = 'ativo'
        ))
        AND (
          s.scope_type = 'empresa'
          OR (s.scope_type = 'pilar' AND _pillar IS NOT NULL AND s.scope_ref = _pillar)
          OR (s.scope_type = 'departamento' AND _department IS NOT NULL AND s.scope_ref = _department)
        )
    ) END
$$;

-- Somente Super Admin administra vínculos; convites empresariais passam pela Edge Function.
DROP POLICY IF EXISTS "company_access_write_staff" ON public.company_access;
CREATE POLICY "company_access_write_super_admin" ON public.company_access FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "access_scopes_write" ON public.access_scopes;
CREATE POLICY "access_scopes_write_super_admin" ON public.access_scopes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "access_grants_write" ON public.access_grants;
CREATE POLICY "access_grants_write_super_admin" ON public.access_grants FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------------------------
-- Catálogo: dados internos somente para staff; cliente vê a versão contratada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_product_version(_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.product_version_id = _version_id
      AND c.status IN ('ativo','pausado','concluido')
      AND public.is_company_member(auth.uid(), c.company_id)
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_product_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_product_version(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "config catalogo visivel autenticados" ON public.product_version_config;
CREATE POLICY "config visivel por contratacao" ON public.product_version_config FOR SELECT TO authenticated
USING (public.can_view_product_version(product_version_id));
DROP POLICY IF EXISTS "encontros versao visiveis autenticados" ON public.product_version_meetings;
CREATE POLICY "encontros visiveis por contratacao" ON public.product_version_meetings FOR SELECT TO authenticated
USING (public.can_view_product_version(product_version_id));
DROP POLICY IF EXISTS "etapas versao visiveis autenticados" ON public.product_version_stages;
CREATE POLICY "etapas visiveis por contratacao" ON public.product_version_stages FOR SELECT TO authenticated
USING (public.can_view_product_version(product_version_id));
DROP POLICY IF EXISTS "entregaveis versao visiveis autenticados" ON public.product_version_deliverables;
CREATE POLICY "entregaveis visiveis por contratacao" ON public.product_version_deliverables FOR SELECT TO authenticated
USING (public.can_view_product_version(product_version_id));
DROP POLICY IF EXISTS "heranca visivel autenticados" ON public.product_inheritance;
CREATE POLICY "heranca visivel staff" ON public.product_inheritance FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "upgrades visiveis autenticados" ON public.product_upgrade_paths;
CREATE POLICY "upgrades visiveis staff" ON public.product_upgrade_paths FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Ciclo de vida de versão: rascunho -> publicação explícita -> imutabilidade.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_published_product_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Versao publicada nao pode ser excluida; desative-a ou crie uma nova versao.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL AND (
    NEW.product_id IS DISTINCT FROM OLD.product_id OR
    NEW.version_label IS DISTINCT FROM OLD.version_label OR
    NEW.methodology_code IS DISTINCT FROM OLD.methodology_code OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.cycle_count IS DISTINCT FROM OLD.cycle_count OR
    NEW.duration_days IS DISTINCT FROM OLD.duration_days OR
    NEW.published_at IS DISTINCT FROM OLD.published_at
  ) THEN
    RAISE EXCEPTION 'Versao publicada e imutavel; duplique-a para editar.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_product_version_published_immutable ON public.product_versions;
CREATE TRIGGER trg_product_version_published_immutable
BEFORE UPDATE OR DELETE ON public.product_versions FOR EACH ROW EXECUTE FUNCTION public.protect_published_product_version();

CREATE OR REPLACE FUNCTION public.publish_product_version(_version_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_version_config c WHERE c.product_version_id = _version_id) THEN
    RAISE EXCEPTION 'Configure os dados gerais da versao antes de publicar.';
  END IF;
  UPDATE public.product_versions SET published_at = now(), is_active = true WHERE id = _version_id AND published_at IS NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.publish_product_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_product_version(uuid) TO authenticated, service_role;

-- Duplicação atômica: qualquer falha desfaz toda a cópia.
CREATE OR REPLACE FUNCTION public.clone_product_version(_source_id uuid, _label text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.product_versions%ROWTYPE; new_id uuid; s record; new_stage uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO src FROM public.product_versions WHERE id = _source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versao de origem nao encontrada.'; END IF;
  INSERT INTO public.product_versions(product_id,version_label,methodology_code,description,cycle_count,duration_days,is_active,published_at)
  VALUES(src.product_id,COALESCE(NULLIF(BTRIM(_label),''),src.version_label || ' (copia)'),src.methodology_code,src.description,src.cycle_count,src.duration_days,false,NULL)
  RETURNING id INTO new_id;
  INSERT INTO public.product_version_config(product_version_id,price_cents,currency,format,audience,duration_amount,duration_unit,access_days,support_model,community_included,bonuses,ai_enabled,catalog_visibility,sales_url,checkout_url,recommendation_mode,notes,diagnostic_weights)
  SELECT new_id,price_cents,currency,format,audience,duration_amount,duration_unit,access_days,support_model,community_included,bonuses,ai_enabled,catalog_visibility,sales_url,checkout_url,recommendation_mode,notes,diagnostic_weights
  FROM public.product_version_config WHERE product_version_id = _source_id;
  INSERT INTO public.product_version_meetings(product_version_id,meeting_type,title,quantity,duration_min,cadence,required,order_index,notes)
  SELECT new_id,meeting_type,title,quantity,duration_min,cadence,required,order_index,notes FROM public.product_version_meetings WHERE product_version_id = _source_id;
  FOR s IN SELECT * FROM public.product_version_stages WHERE product_version_id = _source_id ORDER BY order_index LOOP
    INSERT INTO public.product_version_stages(product_version_id,title,description,order_index,duration_days,cycle_number)
    VALUES(new_id,s.title,s.description,s.order_index,s.duration_days,s.cycle_number) RETURNING id INTO new_stage;
    INSERT INTO public.product_version_deliverables(product_version_id,stage_id,title,description,format,required,order_index)
    SELECT new_id,new_stage,title,description,format,required,order_index FROM public.product_version_deliverables WHERE stage_id = s.id;
  END LOOP;
  INSERT INTO public.product_version_deliverables(product_version_id,stage_id,title,description,format,required,order_index)
  SELECT new_id,NULL,title,description,format,required,order_index FROM public.product_version_deliverables WHERE product_version_id = _source_id AND stage_id IS NULL;
  INSERT INTO public.product_inheritance(base_version_id,derived_version_id,inherited_components,notes)
  VALUES(_source_id,new_id,ARRAY['config','encontros','etapas','entregaveis'],'Copia transacional da versao base.');
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.clone_product_version(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_product_version(uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Governança do Top 5 e das Metas Críticas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_top5_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.rank_position IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.rank_position IS DISTINCT FROM OLD.rank_position) THEN
    IF NOT public.is_consultor(auth.uid()) THEN RAISE EXCEPTION 'Somente o Consultor 4X pode alterar o Top 5.'; END IF;
    IF NEW.rank_position IS NOT NULL AND (NEW.rank_position < 1 OR NEW.rank_position > 5) THEN
      RAISE EXCEPTION 'A posicao do Top 5 deve estar entre 1 e 5.';
    END IF;
    IF NEW.rank_position IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bottlenecks b WHERE b.company_id = NEW.company_id
        AND b.contract_id IS NOT DISTINCT FROM NEW.contract_id AND b.id <> NEW.id
        AND b.rank_position = NEW.rank_position AND COALESCE(b.resolved, false) IS FALSE
    ) THEN RAISE EXCEPTION 'Esta posicao do Top 5 ja esta ocupada.'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_enforce_top5_governance ON public.bottlenecks;
CREATE TRIGGER zz_enforce_top5_governance BEFORE INSERT OR UPDATE OF rank_position ON public.bottlenecks
FOR EACH ROW EXECUTE FUNCTION public.enforce_top5_governance();

CREATE OR REPLACE FUNCTION public.finalize_goal_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE active_count integer;
BEGIN
  -- Cliente, Responsável, Líder e Estrategista podem propor; aprovação é do Consultor.
  IF TG_OP = 'INSERT' AND NOT public.is_consultor(auth.uid()) THEN
    NEW.approval_status := 'pendente'; NEW.approved_by := NULL; NEW.approved_at := NULL;
  ELSIF TG_OP = 'UPDATE' AND NOT public.is_consultor(auth.uid()) THEN
    -- Atualizações de execução não podem desfazer nem forjar a decisão do Consultor.
    NEW.approval_status := OLD.approval_status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.is_critical := OLD.is_critical;
    NEW.capacity_justification := OLD.capacity_justification;
  END IF;
  IF NEW.is_critical AND NEW.approval_status = 'aprovada' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text || COALESCE(NEW.contract_id::text,'')));
    SELECT count(*) INTO active_count FROM public.goals g
      WHERE g.company_id=NEW.company_id AND g.contract_id IS NOT DISTINCT FROM NEW.contract_id
        AND g.id<>NEW.id AND g.is_critical AND g.approval_status='aprovada'
        AND g.status IN ('nao_iniciado','em_andamento','atrasado','bloqueado');
    IF active_count >= 2 AND NULLIF(BTRIM(COALESCE(NEW.capacity_justification,'')),'') IS NULL THEN
      RAISE EXCEPTION 'A terceira Meta Critica exige justificativa de capacidade e aprovacao do Consultor 4X.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_finalize_goal_governance ON public.goals;
CREATE TRIGGER zz_finalize_goal_governance BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.finalize_goal_governance();

-- ---------------------------------------------------------------------------
-- IA: permite reserva atômica da proposta antes da execução.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_proposals DROP CONSTRAINT IF EXISTS ai_proposals_status_check;
ALTER TABLE public.ai_proposals ADD CONSTRAINT ai_proposals_status_check
CHECK (status IN ('pendente','executando','aprovada','rejeitada','executada','falhou','expirada'));
