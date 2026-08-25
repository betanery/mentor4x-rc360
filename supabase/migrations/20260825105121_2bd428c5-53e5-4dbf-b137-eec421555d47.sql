ALTER TABLE public.cycle_records DROP CONSTRAINT IF EXISTS cycle_records_company_id_cycle_key;
ALTER TABLE public.weekly_reviews DROP CONSTRAINT IF EXISTS weekly_reviews_company_id_week_start_key;
ALTER TABLE public.journey_checklist DROP CONSTRAINT IF EXISTS journey_checklist_company_id_stage_item_type_item_key_key;

ALTER TABLE public.cycle_records
  ADD CONSTRAINT cycle_records_company_contract_cycle_key UNIQUE (company_id, contract_id, cycle);

ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_company_contract_week_key UNIQUE (company_id, contract_id, week_start);

ALTER TABLE public.journey_checklist
  ADD CONSTRAINT journey_checklist_company_contract_item_key UNIQUE (company_id, contract_id, stage, item_type, item_key);