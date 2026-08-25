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

CREATE OR REPLACE FUNCTION public.enforce_critical_goal_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE active_count int;
BEGIN
  IF NEW.is_critical IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.approval_status <> 'pendente' AND NEW.status IN ('nao_iniciado','em_andamento','atrasado','bloqueado') THEN
    SELECT count(*) INTO active_count
    FROM public.goals g
    WHERE g.company_id = NEW.company_id
      AND g.contract_id IS NOT DISTINCT FROM NEW.contract_id
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
$function$;

REVOKE ALL ON FUNCTION public.enforce_goal_governance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_critical_goal_limit() FROM PUBLIC, anon, authenticated;