ALTER TABLE public.product_version_config
  ADD COLUMN IF NOT EXISTS promise text,
  ADD COLUMN IF NOT EXISTS ladder_level text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS modality text,
  ADD COLUMN IF NOT EXISTS diagnostic_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_critical_goals integer,
  ADD COLUMN IF NOT EXISTS action_plan_days integer,
  ADD COLUMN IF NOT EXISTS completion_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS goal_required_fields jsonb NOT NULL DEFAULT '[]'::jsonb;