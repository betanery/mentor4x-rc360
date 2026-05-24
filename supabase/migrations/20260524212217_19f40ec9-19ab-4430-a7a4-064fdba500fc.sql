
-- Storage policies for company logos in 'avatars' bucket (public read already)
CREATE POLICY "avatars_company_logo_staff_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'companies' AND public.is_staff(auth.uid()));

CREATE POLICY "avatars_company_logo_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'companies' AND public.is_staff(auth.uid()));

CREATE POLICY "avatars_company_logo_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'companies' AND public.is_staff(auth.uid()));

-- Storage policies for 'evidences' bucket (private): users in company can read/write
CREATE POLICY "evidences_member_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "evidences_member_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "evidences_member_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "evidences_member_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
