CREATE TABLE IF NOT EXISTS public.ai_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  tool_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  instruction text,
  ai_message text,
  required_scope text NOT NULL DEFAULT 'membro',
  status text NOT NULL DEFAULT 'pendente',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamp with time zone,
  entity text,
  entity_id uuid,
  error_message text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_proposals_status_check CHECK (status IN ('pendente','aprovada','rejeitada','executada','falhou','expirada')),
  CONSTRAINT ai_proposals_scope_check CHECK (required_scope IN ('membro','estrategista','consultor'))
);

GRANT SELECT ON public.ai_proposals TO authenticated;
GRANT ALL ON public.ai_proposals TO service_role;

ALTER TABLE public.ai_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_proposals_select" ON public.ai_proposals
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER trg_ai_proposals_updated
BEFORE UPDATE ON public.ai_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ai_proposals_company ON public.ai_proposals(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_proposals_status ON public.ai_proposals(status, expires_at);