-- Fix avatars bucket: add DELETE policy and tighten SELECT
CREATE POLICY "Avatars staff delete logos" ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND is_staff(auth.uid()));

CREATE POLICY "Avatars user delete own" ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Drop the old broad SELECT and recreate with folder-based check
DROP POLICY IF EXISTS "Avatars public read individual" ON storage.objects;
CREATE POLICY "Avatars public read by path" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

-- Fix invite_audit: add staff DELETE policy
CREATE POLICY "invite_audit_staff_delete" ON public.invite_audit
FOR DELETE USING (is_staff(auth.uid()));