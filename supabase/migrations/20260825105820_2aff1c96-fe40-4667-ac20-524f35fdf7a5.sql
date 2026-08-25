ALTER TABLE public.pillar_scores
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pillar_scores_contract_id ON public.pillar_scores(contract_id);

DROP TRIGGER IF EXISTS pillar_scores_contract_company_match ON public.pillar_scores;
CREATE TRIGGER pillar_scores_contract_company_match
BEFORE INSERT OR UPDATE ON public.pillar_scores
FOR EACH ROW EXECUTE FUNCTION public.ensure_contract_matches_company();