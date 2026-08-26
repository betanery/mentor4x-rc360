CREATE TABLE public.bottleneck_rank_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  bottleneck_id uuid NOT NULL REFERENCES public.bottlenecks(id) ON DELETE CASCADE,
  cycle text,
  previous_position integer,
  new_position integer,
  changed_by uuid REFERENCES auth.users(id),
  justification text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bottleneck_rank_history TO authenticated;
GRANT ALL ON public.bottleneck_rank_history TO service_role;

ALTER TABLE public.bottleneck_rank_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rank_history_select" ON public.bottleneck_rank_history
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "rank_history_insert" ON public.bottleneck_rank_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_consultor(auth.uid()));

CREATE INDEX idx_rank_history_company ON public.bottleneck_rank_history(company_id, created_at DESC);
CREATE INDEX idx_rank_history_bottleneck ON public.bottleneck_rank_history(bottleneck_id, created_at DESC);

-- Registro automático de mudanças de posição no Top 5
CREATE OR REPLACE FUNCTION public.log_bottleneck_rank_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cycle text;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.rank_position, -1) = COALESCE(OLD.rank_position, -1) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.rank_position IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT 'ciclo_' || c.current_cycle INTO _cycle
  FROM public.contracts c WHERE c.id = NEW.contract_id;

  INSERT INTO public.bottleneck_rank_history
    (company_id, contract_id, bottleneck_id, cycle, previous_position, new_position, changed_by)
  VALUES (
    NEW.company_id,
    NEW.contract_id,
    NEW.id,
    _cycle,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.rank_position ELSE NULL END,
    NEW.rank_position,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_bottleneck_rank_change
AFTER INSERT OR UPDATE OF rank_position ON public.bottlenecks
FOR EACH ROW EXECUTE FUNCTION public.log_bottleneck_rank_change();

-- Campos aditivos em metas (nenhuma meta existente é invalidada)
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS current_situation text,
  ADD COLUMN IF NOT EXISTS expected_result text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users(id);