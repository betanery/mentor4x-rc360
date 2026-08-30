CREATE TABLE public.diagnostic_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostics(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  invite_kind text NOT NULL DEFAULT 'individual',
  full_name text,
  email text,
  role_title text,
  respondent_group respondent_group NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  sent_at timestamp with time zone,
  responded_at timestamp with time zone,
  response_id uuid REFERENCES public.diagnostic_responses(id) ON DELETE SET NULL,
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_invites_kind_chk CHECK (invite_kind IN ('geral','individual')),
  CONSTRAINT diagnostic_invites_status_chk CHECK (status IN ('pendente','enviado','respondido','expirado','cancelado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_invites TO authenticated;
GRANT ALL ON public.diagnostic_invites TO service_role;

ALTER TABLE public.diagnostic_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select_company" ON public.diagnostic_invites
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "invites_insert_staff" ON public.diagnostic_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "invites_update_staff" ON public.diagnostic_invites
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "invites_delete_staff" ON public.diagnostic_invites
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX diagnostic_invites_diag_idx ON public.diagnostic_invites (diagnostic_id);
CREATE UNIQUE INDEX diagnostic_invites_one_general_idx ON public.diagnostic_invites (diagnostic_id) WHERE invite_kind = 'geral';

CREATE TRIGGER diagnostic_invites_updated_at
  BEFORE UPDATE ON public.diagnostic_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.diagnostic_responses
  ADD COLUMN IF NOT EXISTS respondent_role text,
  ADD COLUMN IF NOT EXISTS collection_method text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS interviewer_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.diagnostic_responses
  ADD CONSTRAINT diagnostic_responses_method_chk CHECK (collection_method IN ('self','link','entrevista'));