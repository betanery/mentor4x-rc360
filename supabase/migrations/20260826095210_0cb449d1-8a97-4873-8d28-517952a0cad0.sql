-- Fase 1c: matriz de alçadas + separação Consultor 4X / Estrategista 4X

CREATE OR REPLACE FUNCTION public.is_consultor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('super_admin','mentor')
    )
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.is_consultor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_consultor(uuid) TO authenticated, service_role;

-- Matriz explícita de alçadas (documentação executável, lida pela interface)
CREATE TABLE IF NOT EXISTS public.role_capabilities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  capability text NOT NULL,
  scope text NOT NULL DEFAULT 'global',
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_capabilities_unique UNIQUE (role, capability)
);

GRANT SELECT ON public.role_capabilities TO authenticated;
GRANT ALL ON public.role_capabilities TO service_role;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_capabilities_select" ON public.role_capabilities
FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_capabilities_super_admin_modify" ON public.role_capabilities
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_role_capabilities_updated
BEFORE UPDATE ON public.role_capabilities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_capabilities (role, capability, scope, description) VALUES
  ('super_admin','manage_users','global','Convidar, editar e desativar usuários e papéis'),
  ('super_admin','manage_companies','global','Criar e editar empresas'),
  ('super_admin','manage_catalog','global','Produtos, versões e contratações'),
  ('super_admin','view_audit','global','Auditoria e logs globais'),
  ('mentor','validate_diagnostic','company','Validar o diagnóstico final'),
  ('mentor','approve_goal','company','Formular e aprovar Metas 4X'),
  ('mentor','change_top5','company','Alterar definitivamente o Top 5'),
  ('mentor','approve_ata','company','Aprovar o Resumo de Ação'),
  ('mentor','close_cycle','company','Fechar ciclos'),
  ('mentor','issue_certificate','company','Emitir certificados'),
  ('mentor','view_audit','company','Auditoria da empresa'),
  ('estrategista','run_meetings','company','Conduzir encontros e Salas de Guerra'),
  ('estrategista','validate_execution','company','Validar execução operacional'),
  ('estrategista','draft_ata','company','Elaborar rascunho e solicitar ajustes na ata'),
  ('estrategista','draft_goal','company','Propor rascunhos de metas e tarefas'),
  ('estrategista','support_client','company','Apoio ao cliente'),
  ('cliente_dono','view_company','own_company','Acessar dados da própria empresa'),
  ('cliente_dono','execute_goals','own_company','Executar metas e registrar evidências'),
  ('gestor_cliente','view_company','own_company','Acessar dados da própria empresa'),
  ('gestor_cliente','execute_goals','own_company','Executar metas e registrar evidências'),
  ('colaborador_cliente','view_company','own_company','Acessar dados autorizados da própria empresa')
ON CONFLICT (role, capability) DO NOTHING;

-- Metas: aprovação reservada ao Consultor 4X
CREATE OR REPLACE FUNCTION public.enforce_goal_governance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  active_count integer;
  actor uuid := auth.uid();
  actor_is_staff boolean := public.is_staff(auth.uid());
  actor_is_consultor boolean := public.is_consultor(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := actor;
    END IF;

    IF actor_is_staff IS NOT TRUE THEN
      IF actor IS NOT NULL THEN
        NEW.created_by := actor;
      END IF;
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;

      IF NEW.is_critical IS TRUE THEN
        SELECT count(*) INTO active_count
        FROM public.goals g
        WHERE g.company_id = NEW.company_id
          AND g.contract_id IS NOT DISTINCT FROM NEW.contract_id
          AND g.id <> NEW.id
          AND g.is_critical IS TRUE
          AND g.approval_status = 'aprovada'
          AND g.status IN ('nao_iniciado','em_andamento','atrasado','bloqueado');

        IF active_count >= 2 THEN
          IF NULLIF(BTRIM(COALESCE(NEW.capacity_justification, '')), '') IS NULL THEN
            RAISE EXCEPTION 'Limite de 2 Metas Criticas ativas atingido: a terceira exige justificativa de capacidade e aprovacao do Consultor 4X.';
          END IF;
          NEW.approval_status := 'pendente';
        ELSE
          NEW.approval_status := 'aprovada';
          NEW.capacity_justification := NULL;
        END IF;
      ELSE
        NEW.approval_status := 'aprovada';
        NEW.capacity_justification := NULL;
      END IF;
    ELSE
      -- Staff nao consultor nao pode nascer com meta aprovada/rejeitada por ele
      IF actor_is_consultor IS NOT TRUE AND NEW.approval_status IN ('aprovada','rejeitada') AND NEW.is_critical IS TRUE THEN
        NEW.approval_status := 'pendente';
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
      ELSIF NEW.approval_status IN ('aprovada', 'rejeitada') AND NEW.approved_by IS NULL THEN
        NEW.approved_by := actor;
        NEW.approved_at := COALESCE(NEW.approved_at, now());
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF actor_is_staff IS NOT TRUE THEN
      IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'A empresa vinculada da meta nao pode ser alterada.';
      END IF;
      IF NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
        RAISE EXCEPTION 'A contratacao vinculada da meta nao pode ser alterada.';
      END IF;
      IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'A autoria da meta nao pode ser alterada.';
      END IF;
      IF NEW.is_critical IS DISTINCT FROM OLD.is_critical
        OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
        OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
        OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        OR NEW.capacity_justification IS DISTINCT FROM OLD.capacity_justification THEN
        RAISE EXCEPTION 'Somente o Consultor 4X pode alterar campos de aprovacao e alcada.';
      END IF;
      IF NEW.mentor_comment IS DISTINCT FROM OLD.mentor_comment THEN
        RAISE EXCEPTION 'Somente o time interno pode alterar o parecer da meta.';
      END IF;
    ELSE
      IF actor_is_consultor IS NOT TRUE THEN
        IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
          OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
          OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
          OR NEW.is_critical IS DISTINCT FROM OLD.is_critical THEN
          RAISE EXCEPTION 'Somente o Consultor 4X pode aprovar, rejeitar ou reclassificar Metas 4X.';
        END IF;
      ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status
        AND NEW.approval_status IN ('aprovada', 'rejeitada')
        AND NEW.approved_by IS NULL THEN
        NEW.approved_by := actor;
        NEW.approved_at := COALESCE(NEW.approved_at, now());
      END IF;
    END IF;

  RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_goal_governance() FROM PUBLIC, anon, authenticated;

-- Ata: aprovacao reservada ao Consultor 4X (Estrategista faz rascunho e pede ajustes)
CREATE OR REPLACE FUNCTION public.enforce_weekly_review_ata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  actor uuid := auth.uid();
  actor_is_staff boolean := public.is_staff(auth.uid());
  actor_is_consultor boolean := public.is_consultor(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF actor_is_staff IS NOT TRUE THEN
      NEW.ata_status := COALESCE(NULLIF(NEW.ata_status, 'aprovada'), 'rascunho');
      IF NEW.ata_status NOT IN ('rascunho','em_revisao') THEN
        NEW.ata_status := 'rascunho';
      END IF;
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
      NEW.review_comment := NULL;
    ELSIF actor_is_consultor IS NOT TRUE AND NEW.ata_status = 'aprovada' THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode aprovar o Resumo de Acao.';
    END IF;
    IF NEW.ata_status = 'em_revisao' AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now();
      NEW.submitted_by := COALESCE(NEW.submitted_by, actor);
    END IF;
    RETURN NEW;
  END IF;

  IF actor_is_staff IS NOT TRUE THEN
    IF OLD.ata_status = 'aprovada' THEN
      RAISE EXCEPTION 'Resumo de Acao aprovado: somente o Consultor 4X pode alterar.';
    END IF;
    IF NEW.ata_status NOT IN ('rascunho','em_revisao') THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode aprovar ou solicitar ajustes no Resumo de Acao.';
    END IF;
    IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode registrar o parecer do Resumo de Acao.';
    END IF;
  ELSIF actor_is_consultor IS NOT TRUE THEN
    IF NEW.ata_status = 'aprovada' AND OLD.ata_status <> 'aprovada' THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode aprovar o Resumo de Acao.';
    END IF;
    IF OLD.ata_status = 'aprovada' AND NEW.ata_status IS DISTINCT FROM OLD.ata_status THEN
      RAISE EXCEPTION 'Resumo de Acao aprovado: somente o Consultor 4X pode reabrir.';
    END IF;
  END IF;

  IF NEW.ata_status = 'em_revisao' AND OLD.ata_status <> 'em_revisao' THEN
    NEW.submitted_at := now();
    NEW.submitted_by := actor;
  END IF;

  IF NEW.ata_status IN ('aprovada','ajustes_solicitados') AND NEW.ata_status <> OLD.ata_status THEN
    NEW.reviewed_at := now();
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, actor);
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_weekly_review_ata() FROM PUBLIC, anon, authenticated;

-- Fechamento de ciclo reservado ao Consultor 4X
CREATE OR REPLACE FUNCTION public.enforce_cycle_closing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  actor_is_consultor boolean := public.is_consultor(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.closed_at IS NOT NULL AND actor_is_consultor IS NOT TRUE THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode fechar um ciclo.';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.closed_at IS DISTINCT FROM OLD.closed_at
      OR NEW.closed_by IS DISTINCT FROM OLD.closed_by
      OR NEW.gate_override_justification IS DISTINCT FROM OLD.gate_override_justification)
     AND actor_is_consultor IS NOT TRUE THEN
    RAISE EXCEPTION 'Somente o Consultor 4X pode fechar ou reabrir um ciclo.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_cycle_closing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_cycle_records_closing ON public.cycle_records;
CREATE TRIGGER a_cycle_records_closing
BEFORE INSERT OR UPDATE ON public.cycle_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_cycle_closing();

-- Certificados: emissao reservada ao Consultor 4X
DROP POLICY IF EXISTS "cert_staff_modify" ON public.certificates;
CREATE POLICY "cert_consultor_modify" ON public.certificates
FOR ALL TO authenticated
USING (public.is_consultor(auth.uid()))
WITH CHECK (public.is_consultor(auth.uid()));