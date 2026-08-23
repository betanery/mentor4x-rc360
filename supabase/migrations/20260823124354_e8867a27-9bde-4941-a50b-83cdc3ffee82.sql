ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'aprovada',
  ADD COLUMN IF NOT EXISTS capacity_justification text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.goals ADD CONSTRAINT goals_approval_status_chk
    CHECK (approval_status IN ('aprovada','pendente','rejeitada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.governance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  justification text,
  previous_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.governance_log TO authenticated;
GRANT ALL ON public.governance_log TO service_role;
ALTER TABLE public.governance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_log_select" ON public.governance_log;
CREATE POLICY "governance_log_select" ON public.governance_log
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "governance_log_insert" ON public.governance_log;
CREATE POLICY "governance_log_insert" ON public.governance_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id)));

CREATE INDEX IF NOT EXISTS governance_log_company_idx ON public.governance_log(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_critical_goal_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE active_count int;
BEGIN
  IF NEW.is_critical IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.approval_status <> 'pendente' AND NEW.status IN ('nao_iniciado','em_andamento','atrasado','bloqueado') THEN
    SELECT count(*) INTO active_count
    FROM public.goals g
    WHERE g.company_id = NEW.company_id
      AND g.id <> NEW.id
      AND g.is_critical
      AND g.approval_status = 'aprovada'
      AND g.status IN ('nao_iniciado','em_andamento','atrasado','bloqueado');
    IF active_count >= 2 AND (NEW.approved_by IS NULL OR NEW.capacity_justification IS NULL) THEN
      RAISE EXCEPTION 'Limite de 2 Metas Criticas ativas atingido: a terceira exige justificativa de capacidade e aprovacao do Consultor 4X.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_critical_goal_limit() FROM public, anon;

DROP TRIGGER IF EXISTS goals_critical_limit ON public.goals;
CREATE TRIGGER goals_critical_limit
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_critical_goal_limit();