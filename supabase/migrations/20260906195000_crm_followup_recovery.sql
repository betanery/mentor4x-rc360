-- CRM Fase 2: follow-up, histórico e recuperação

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_crm_activities" ON public.crm_activities;
CREATE POLICY "staff_manage_crm_activities"
ON public.crm_activities
FOR ALL
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON public.crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity_id ON public.crm_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_at ON public.crm_activities(due_at);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_next_action_at ON public.crm_opportunities(next_action_at);
