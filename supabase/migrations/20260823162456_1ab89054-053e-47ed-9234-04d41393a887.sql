CREATE TABLE public.cycle_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid,
  summary text,
  evidence_url text,
  gate_override_justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cycle)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_records TO authenticated;
GRANT ALL ON public.cycle_records TO service_role;

ALTER TABLE public.cycle_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cycle_records_select" ON public.cycle_records
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "cycle_records_write" ON public.cycle_records
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND (public.is_company_member(auth.uid(), company_id) OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "cycle_records_update" ON public.cycle_records
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) AND (public.is_company_member(auth.uid(), company_id) OR public.has_role(auth.uid(), 'super_admin')))
WITH CHECK (public.is_staff(auth.uid()) AND (public.is_company_member(auth.uid(), company_id) OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "cycle_records_delete" ON public.cycle_records
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_cycle_records_updated
BEFORE UPDATE ON public.cycle_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();