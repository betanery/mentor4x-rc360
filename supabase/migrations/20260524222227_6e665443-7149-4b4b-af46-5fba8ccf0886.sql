-- Revoke EXECUTE on helper functions from public/anon roles to clean up linter warnings.
-- These functions are still used by RLS policies (which run with table owner privileges).

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_companies(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_meeting_created() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_goal_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_pillar_score() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

-- Tighten avatars bucket SELECT policy: only allow staff to list, but public can read individual files via URL
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars public read individual" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

-- Grant EXECUTE to authenticated (needed for RLS policies to reference them)
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_companies(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_meeting_created() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_goal_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_pillar_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;