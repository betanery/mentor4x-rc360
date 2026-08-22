ALTER TABLE public.bottlenecks
  ADD COLUMN IF NOT EXISTS blindspot_code text,
  ADD COLUMN IF NOT EXISTS diagnostic_id uuid REFERENCES public.diagnostics(id) ON DELETE SET NULL;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS blindspot_code text,
  ADD COLUMN IF NOT EXISTS capacity_code text,
  ADD COLUMN IF NOT EXISTS bottleneck_id uuid REFERENCES public.bottlenecks(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bottlenecks_blindspot ON public.bottlenecks(company_id, blindspot_code);
CREATE INDEX IF NOT EXISTS idx_goals_blindspot ON public.goals(company_id, blindspot_code);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON public.tasks(goal_id);