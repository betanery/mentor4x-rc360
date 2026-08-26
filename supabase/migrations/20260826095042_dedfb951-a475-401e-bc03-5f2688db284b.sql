-- Fase 1b: restaura EXECUTE apenas nas funções de autorização usadas pelas políticas RLS.
-- As funções permanecem SECURITY DEFINER com search_path fixo e guarda interna
-- (respondem somente para auth.uid() ou service_role), evitando escalada de privilégio.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_companies(uuid) TO authenticated;

-- anon e PUBLIC continuam sem acesso
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_companies(uuid) FROM PUBLIC, anon;