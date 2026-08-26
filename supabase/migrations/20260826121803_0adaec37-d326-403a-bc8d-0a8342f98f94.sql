ALTER TABLE public.lead_diagnostics
  ADD COLUMN IF NOT EXISTS consent_lgpd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_ip_hash text;

CREATE TABLE IF NOT EXISTS public.lead_throttle (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_hash, action, window_start)
);

GRANT ALL ON public.lead_throttle TO service_role;

ALTER TABLE public.lead_throttle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_throttle_no_client_access"
ON public.lead_throttle
FOR SELECT
TO authenticated
USING (false);

CREATE TRIGGER update_lead_throttle_updated_at
BEFORE UPDATE ON public.lead_throttle
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_lead_throttle_window ON public.lead_throttle(window_start);