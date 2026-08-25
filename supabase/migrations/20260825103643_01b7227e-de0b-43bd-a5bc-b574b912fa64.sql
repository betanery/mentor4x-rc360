-- C1: harden bottleneck and goal RLS / governance
DROP POLICY IF EXISTS "bottlenecks_modify" ON public.bottlenecks;
DROP POLICY IF EXISTS "bottlenecks_insert_staff" ON public.bottlenecks;
DROP POLICY IF EXISTS "bottlenecks_update_staff" ON public.bottlenecks;
DROP POLICY IF EXISTS "bottlenecks_delete_staff" ON public.bottlenecks;

CREATE POLICY "bottlenecks_insert_staff"
ON public.bottlenecks
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "bottlenecks_update_staff"
ON public.bottlenecks
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "bottlenecks_delete_staff"
ON public.bottlenecks
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.enforce_goal_governance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_count integer;
  actor uuid := auth.uid();
  actor_is_staff boolean := public.is_staff(auth.uid());
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
      IF NEW.approval_status IN ('aprovada', 'rejeitada') AND NEW.approved_by IS NULL THEN
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
        RAISE EXCEPTION 'Somente o Consultor 4X pode alterar o parecer da meta.';
      END IF;
    ELSE
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
        AND NEW.approval_status IN ('aprovada', 'rejeitada')
        AND NEW.approved_by IS NULL THEN
        NEW.approved_by := actor;
        NEW.approved_at := COALESCE(NEW.approved_at, now());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_goals_governance ON public.goals;
CREATE TRIGGER a_goals_governance
BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_goal_governance();

REVOKE ALL ON FUNCTION public.enforce_goal_governance() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "goals_modify" ON public.goals;
DROP POLICY IF EXISTS "goals_insert_company" ON public.goals;
DROP POLICY IF EXISTS "goals_update_company" ON public.goals;
DROP POLICY IF EXISTS "goals_delete_staff" ON public.goals;

CREATE POLICY "goals_insert_company"
ON public.goals
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "goals_update_company"
ON public.goals
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "goals_delete_staff"
ON public.goals
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

-- C2: product catalog, product versions, and company contracts
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  category text NOT NULL DEFAULT 'SEE_4X',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT products_slug_format_chk CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_active"
ON public.products
FOR SELECT
TO authenticated
USING (is_active OR public.is_staff(auth.uid()));

CREATE POLICY "products_staff_modify"
ON public.products
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.product_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  methodology_code text NOT NULL DEFAULT 'SEE_4X',
  description text,
  cycle_count integer NOT NULL DEFAULT 6,
  duration_days integer,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_versions_cycle_count_chk CHECK (cycle_count BETWEEN 1 AND 24),
  CONSTRAINT product_versions_duration_days_chk CHECK (duration_days IS NULL OR duration_days > 0),
  CONSTRAINT product_versions_unique_label UNIQUE (product_id, version_label)
);

GRANT SELECT ON public.product_versions TO authenticated;
GRANT ALL ON public.product_versions TO service_role;
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_versions_select_active"
ON public.product_versions
FOR SELECT
TO authenticated
USING (
  public.is_staff(auth.uid())
  OR (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_versions.product_id
        AND p.is_active = true
    )
  )
);

CREATE POLICY "product_versions_staff_modify"
ON public.product_versions
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ativo',
  started_at date,
  expected_completion date,
  completed_at date,
  journey_stage public.journey_stage NOT NULL DEFAULT 'ciclo_1',
  current_cycle integer NOT NULL DEFAULT 1,
  contracted_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contracts_status_chk CHECK (status IN ('rascunho','ativo','pausado','concluido','cancelado')),
  CONSTRAINT contracts_current_cycle_chk CHECK (current_cycle BETWEEN 1 AND 24),
  CONSTRAINT contracts_dates_chk CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

GRANT SELECT ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select_company"
ON public.contracts
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "contracts_staff_modify"
ON public.contracts
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.ensure_contract_product_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  version_product uuid;
BEGIN
  SELECT pv.product_id INTO version_product
  FROM public.product_versions pv
  WHERE pv.id = NEW.product_version_id;

  IF version_product IS NULL THEN
    RAISE EXCEPTION 'Versao de produto nao encontrada.';
  END IF;

  IF version_product <> NEW.product_id THEN
    RAISE EXCEPTION 'A versao selecionada nao pertence ao produto informado.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contracts_product_version_match ON public.contracts;
CREATE TRIGGER contracts_product_version_match
BEFORE INSERT OR UPDATE OF product_id, product_version_id ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_product_version();

CREATE OR REPLACE FUNCTION public.ensure_contract_matches_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  contract_company uuid;
BEGIN
  IF NEW.contract_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.company_id INTO contract_company
  FROM public.contracts c
  WHERE c.id = NEW.contract_id;

  IF contract_company IS NULL THEN
    RAISE EXCEPTION 'Contrato nao encontrado.';
  END IF;

  IF contract_company <> NEW.company_id THEN
    RAISE EXCEPTION 'Contrato nao pertence a empresa informada.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_content_product_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  version_product uuid;
BEGIN
  IF NEW.product_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pv.product_id INTO version_product
  FROM public.product_versions pv
  WHERE pv.id = NEW.product_version_id;

  IF version_product IS NULL THEN
    RAISE EXCEPTION 'Versao de produto nao encontrada.';
  END IF;

  IF NEW.product_id IS NULL THEN
    NEW.product_id := version_product;
  ELSIF NEW.product_id <> version_product THEN
    RAISE EXCEPTION 'A versao selecionada nao pertence ao produto informado.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_contract_product_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_contract_matches_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_content_product_version() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_product_versions_updated
BEFORE UPDATE ON public.product_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_contracts_updated
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.diagnostics ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.bottlenecks ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.cycle_records ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS product_version_id uuid REFERENCES public.product_versions(id) ON DELETE SET NULL;
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS product_version_id uuid REFERENCES public.product_versions(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS diagnostics_contract_company_match ON public.diagnostics;
CREATE TRIGGER diagnostics_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.diagnostics
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS goals_contract_company_match ON public.goals;
CREATE TRIGGER goals_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS bottlenecks_contract_company_match ON public.bottlenecks;
CREATE TRIGGER bottlenecks_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.bottlenecks
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS tasks_contract_company_match ON public.tasks;
CREATE TRIGGER tasks_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS meetings_contract_company_match ON public.meetings;
CREATE TRIGGER meetings_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS cycle_records_contract_company_match ON public.cycle_records;
CREATE TRIGGER cycle_records_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.cycle_records
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS reports_contract_company_match ON public.reports;
CREATE TRIGGER reports_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS certificates_contract_company_match ON public.certificates;
CREATE TRIGGER certificates_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS courses_product_version_match ON public.courses;
CREATE TRIGGER courses_product_version_match
BEFORE INSERT OR UPDATE OF product_id, product_version_id ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.ensure_content_product_version();

DROP TRIGGER IF EXISTS playbooks_product_version_match ON public.playbooks;
CREATE TRIGGER playbooks_product_version_match
BEFORE INSERT OR UPDATE OF product_id, product_version_id ON public.playbooks
FOR EACH ROW
EXECUTE FUNCTION public.ensure_content_product_version();

CREATE INDEX IF NOT EXISTS idx_product_versions_product ON public.product_versions(product_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_product_version ON public.contracts(product_version_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_contract ON public.diagnostics(contract_id);
CREATE INDEX IF NOT EXISTS idx_goals_contract ON public.goals(contract_id);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_contract ON public.bottlenecks(contract_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contract ON public.tasks(contract_id);
CREATE INDEX IF NOT EXISTS idx_meetings_contract ON public.meetings(contract_id);
CREATE INDEX IF NOT EXISTS idx_cycle_records_contract ON public.cycle_records(contract_id);
CREATE INDEX IF NOT EXISTS idx_reports_contract ON public.reports(contract_id);
CREATE INDEX IF NOT EXISTS idx_certificates_contract ON public.certificates(contract_id);
CREATE INDEX IF NOT EXISTS idx_courses_product_version ON public.courses(product_version_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_product_version ON public.playbooks(product_version_id);