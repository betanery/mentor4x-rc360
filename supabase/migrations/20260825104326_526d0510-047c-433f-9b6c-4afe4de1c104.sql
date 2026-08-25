ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.journey_checklist ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS weekly_reviews_contract_company_match ON public.weekly_reviews;
CREATE TRIGGER weekly_reviews_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.weekly_reviews
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

DROP TRIGGER IF EXISTS journey_checklist_contract_company_match ON public.journey_checklist;
CREATE TRIGGER journey_checklist_contract_company_match
BEFORE INSERT OR UPDATE OF company_id, contract_id ON public.journey_checklist
FOR EACH ROW
EXECUTE FUNCTION public.ensure_contract_matches_company();

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_contract ON public.weekly_reviews(contract_id);
CREATE INDEX IF NOT EXISTS idx_journey_checklist_contract ON public.journey_checklist(contract_id);