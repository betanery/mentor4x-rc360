
-- Reports bucket policies (path: <company_id>/...)
CREATE POLICY "reports_read_company_or_staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports' AND (
    public.is_staff(auth.uid())
    OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "reports_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports' AND public.is_staff(auth.uid()));

CREATE POLICY "reports_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reports' AND public.is_staff(auth.uid()));

CREATE POLICY "reports_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reports' AND public.is_staff(auth.uid()));
