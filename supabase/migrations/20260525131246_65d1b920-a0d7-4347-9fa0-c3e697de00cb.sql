
CREATE POLICY "lessons_update_staff" ON storage.objects FOR UPDATE
USING (bucket_id = 'lessons' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'lessons' AND public.is_staff(auth.uid()));

CREATE POLICY "lessons_delete_staff" ON storage.objects FOR DELETE
USING (bucket_id = 'lessons' AND public.is_staff(auth.uid()));
