-- Tighten companies modify: any staff can INSERT, but UPDATE/DELETE only by super_admin or mentor linked to the company
DROP POLICY IF EXISTS companies_staff_modify ON public.companies;

CREATE POLICY companies_staff_insert ON public.companies
  FOR INSERT TO public
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY companies_staff_update ON public.companies
  FOR UPDATE TO public
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id
        AND cm.user_id = auth.uid()
        AND cm.member_role IN ('mentor','estrategista')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id
        AND cm.user_id = auth.uid()
        AND cm.member_role IN ('mentor','estrategista')
    )
  );

CREATE POLICY companies_super_admin_delete ON public.companies
  FOR DELETE TO public
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Helpful index for notifications by user filter
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_logs_company_created_idx
  ON public.ai_logs (company_id, created_at DESC);