CREATE TYPE public.diagnostic_mode AS ENUM ('lead','cliente');
CREATE TYPE public.diagnostic_status AS ENUM ('rascunho','consolidado','validado');
CREATE TYPE public.respondent_group AS ENUM ('dono_socio','gestor','equipe');
CREATE TYPE public.maturity_level AS ENUM ('inicial','emergente','estruturada','escalavel','autonoma');

CREATE TABLE public.diagnostics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mode public.diagnostic_mode NOT NULL DEFAULT 'cliente',
  version integer NOT NULL DEFAULT 1,
  status public.diagnostic_status NOT NULL DEFAULT 'rascunho',
  title text,
  results jsonb,
  maturity public.maturity_level,
  improviso_score integer,
  priority_pillar public.pillar,
  priority_blindspot text,
  idd_score integer,
  notes text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, version)
);

CREATE TABLE public.diagnostic_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid NOT NULL REFERENCES public.diagnostics(id) ON DELETE CASCADE,
  respondent_user_id uuid REFERENCES auth.users(id),
  respondent_name text,
  respondent_group public.respondent_group NOT NULL DEFAULT 'equipe',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostic_id, respondent_user_id)
);

CREATE INDEX idx_diagnostics_company ON public.diagnostics(company_id, version DESC);
CREATE INDEX idx_diagnostic_responses_diag ON public.diagnostic_responses(diagnostic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostics TO authenticated;
GRANT ALL ON public.diagnostics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_responses TO authenticated;
GRANT ALL ON public.diagnostic_responses TO service_role;

ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagnostics_select" ON public.diagnostics FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id) OR public.is_staff(auth.uid()));

CREATE POLICY "diagnostics_staff_insert" ON public.diagnostics FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "diagnostics_staff_update" ON public.diagnostics FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "diagnostics_staff_delete" ON public.diagnostics FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "responses_select" ON public.diagnostic_responses FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.diagnostics d
  WHERE d.id = diagnostic_id
    AND (public.is_company_member(auth.uid(), d.company_id) OR public.is_staff(auth.uid()))
));

CREATE POLICY "responses_insert_own" ON public.diagnostic_responses FOR INSERT TO authenticated
WITH CHECK (
  respondent_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.diagnostics d
    WHERE d.id = diagnostic_id
      AND d.status = 'rascunho'
      AND (public.is_company_member(auth.uid(), d.company_id) OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "responses_update_own" ON public.diagnostic_responses FOR UPDATE TO authenticated
USING (
  respondent_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.diagnostics d WHERE d.id = diagnostic_id AND d.status = 'rascunho')
)
WITH CHECK (respondent_user_id = auth.uid());

CREATE POLICY "responses_staff_delete" ON public.diagnostic_responses FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_diagnostics_updated BEFORE UPDATE ON public.diagnostics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();