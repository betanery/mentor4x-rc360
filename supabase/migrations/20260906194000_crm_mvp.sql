-- CRM MVP for RC360 commercial operation

CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  event_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  product TEXT,
  value NUMERIC(14,2) NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'novo' CHECK (stage IN (
    'novo',
    'qualificado',
    'diagnostico',
    'proposta',
    'negociacao',
    'ganho',
    'perdido',
    'recuperacao'
  )),
  loss_reason TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'nota' CHECK (activity_type IN (
    'ligacao', 'whatsapp', 'email', 'reuniao', 'tarefa', 'nota'
  )),
  title TEXT NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (contact_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

CREATE INDEX crm_contacts_name_idx ON public.crm_contacts (name);
CREATE INDEX crm_contacts_email_idx ON public.crm_contacts (email);
CREATE INDEX crm_opportunities_stage_idx ON public.crm_opportunities (stage);
CREATE INDEX crm_opportunities_contact_idx ON public.crm_opportunities (contact_id);
CREATE INDEX crm_activities_due_idx ON public.crm_activities (due_at) WHERE completed_at IS NULL;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view CRM contacts"
ON public.crm_contacts FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create CRM contacts"
ON public.crm_contacts FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update CRM contacts"
ON public.crm_contacts FOR UPDATE
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete CRM contacts"
ON public.crm_contacts FOR DELETE
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view CRM opportunities"
ON public.crm_opportunities FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create CRM opportunities"
ON public.crm_opportunities FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update CRM opportunities"
ON public.crm_opportunities FOR UPDATE
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete CRM opportunities"
ON public.crm_opportunities FOR DELETE
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view CRM activities"
ON public.crm_activities FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create CRM activities"
ON public.crm_activities FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update CRM activities"
ON public.crm_activities FOR UPDATE
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete CRM activities"
ON public.crm_activities FOR DELETE
USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.crm_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_contacts_touch_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

CREATE TRIGGER crm_opportunities_touch_updated_at
BEFORE UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();
