CREATE TABLE IF NOT EXISTS public.invite_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  invited_by uuid,
  invited_user_id uuid,
  status text NOT NULL DEFAULT 'enviado',
  error_message text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_audit_email ON public.invite_audit(email);
CREATE INDEX IF NOT EXISTS idx_invite_audit_company ON public.invite_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_invite_audit_created ON public.invite_audit(created_at DESC);

ALTER TABLE public.invite_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_audit_staff_select" ON public.invite_audit
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "invite_audit_staff_insert" ON public.invite_audit
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "invite_audit_staff_update" ON public.invite_audit
  FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER set_invite_audit_updated_at
  BEFORE UPDATE ON public.invite_audit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();