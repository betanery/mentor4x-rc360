CREATE TABLE public.lead_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'em_andamento',
  current_step integer NOT NULL DEFAULT 0,
  full_name text,
  email text,
  phone text,
  company_name text,
  segment text,
  revenue_band text,
  team_size text,
  role_title text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  improviso_score integer,
  idd_score integer,
  priority_pillar text,
  priority_blindspot text,
  top5 text[],
  recommendation jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  converted_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  completed_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_diagnostics_status_chk CHECK (status IN ('em_andamento','concluido','convertido','descartado'))
);

CREATE INDEX idx_lead_diagnostics_created ON public.lead_diagnostics (created_at DESC);
CREATE INDEX idx_lead_diagnostics_status ON public.lead_diagnostics (status);
CREATE INDEX idx_lead_diagnostics_utm ON public.lead_diagnostics (utm_source, utm_campaign);

GRANT ALL ON public.lead_diagnostics TO service_role;
GRANT SELECT, UPDATE ON public.lead_diagnostics TO authenticated;

ALTER TABLE public.lead_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode consultar leads" ON public.lead_diagnostics
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff pode atualizar leads" ON public.lead_diagnostics
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_lead_diagnostics_updated
  BEFORE UPDATE ON public.lead_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();