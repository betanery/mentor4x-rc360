ALTER TABLE public.bottlenecks
  ADD COLUMN IF NOT EXISTS rank_position integer,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS expected_result text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS capacity_code text;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blindspot_code text,
  ADD COLUMN IF NOT EXISTS capacity_code text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_tasks_updated ON public.tasks;
CREATE TRIGGER trg_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_task_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.priority NOT IN ('baixa','media','alta','critica') THEN
    RAISE EXCEPTION 'Prioridade invalida da tarefa: %', NEW.priority;
  END IF;
  IF jsonb_typeof(NEW.checklist) <> 'array' THEN
    RAISE EXCEPTION 'Checklist da tarefa deve ser uma lista.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_validate ON public.tasks;
CREATE TRIGGER trg_tasks_validate
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_fields();

REVOKE ALL ON FUNCTION public.validate_task_fields() FROM PUBLIC, anon;

ALTER TABLE public.ai_logs
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS tool_name text,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS entity text,
  ADD COLUMN IF NOT EXISTS entity_id uuid;

CREATE INDEX IF NOT EXISTS idx_ai_logs_company_created ON public.ai_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_company_contract ON public.tasks (company_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_rank ON public.bottlenecks (company_id, rank_position);