CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('super_admin','mentor','estrategista')
    )
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role'
    THEN EXISTS (
      SELECT 1
      FROM public.company_members
      WHERE user_id = _user_id
        AND company_id = _company_id
    )
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.user_companies(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = _user_id
    AND (_user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) = 'service_role')
$function$;

REVOKE ALL ON FUNCTION public.user_companies(uuid) FROM PUBLIC, anon, authenticated;