-- CRM Fase 3: integrações, consentimento e fila de automações

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_external_id ON public.crm_contacts(external_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON public.crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON public.crm_contacts(email);

CREATE TABLE IF NOT EXISTS public.crm_external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_event_id TEXT,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_external_events_dedupe
  ON public.crm_external_events(provider, external_event_id)
  WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_external_events_pending
  ON public.crm_external_events(processed, created_at);

CREATE TABLE IF NOT EXISTS public.crm_automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  automation_type TEXT NOT NULL,
  template_key TEXT,
  subject TEXT,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled','blocked')),
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_automation_queue_due
  ON public.crm_automation_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_crm_automation_queue_contact
  ON public.crm_automation_queue(contact_id, created_at DESC);

ALTER TABLE public.crm_external_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage crm external events" ON public.crm_external_events;
CREATE POLICY "Staff manage crm external events"
ON public.crm_external_events FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff manage crm automation queue" ON public.crm_automation_queue;
CREATE POLICY "Staff manage crm automation queue"
ON public.crm_automation_queue FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.queue_crm_recovery(
  _contact_id UUID,
  _opportunity_id UUID,
  _channel TEXT,
  _automation_type TEXT,
  _message TEXT DEFAULT NULL,
  _subject TEXT DEFAULT NULL,
  _scheduled_at TIMESTAMPTZ DEFAULT now()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _allowed BOOLEAN;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT CASE
    WHEN _channel = 'whatsapp' THEN whatsapp_opt_in
    WHEN _channel = 'email' THEN email_opt_in
    ELSE false
  END INTO _allowed
  FROM public.crm_contacts
  WHERE id = _contact_id;

  INSERT INTO public.crm_automation_queue(
    contact_id, opportunity_id, channel, automation_type,
    subject, message, scheduled_at, status, created_by
  ) VALUES (
    _contact_id, _opportunity_id, _channel, _automation_type,
    _subject, _message, _scheduled_at,
    CASE WHEN COALESCE(_allowed, false) THEN 'pending' ELSE 'blocked' END,
    auth.uid()
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;