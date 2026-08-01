-- 1. Harden has_role: only allow checking your own roles (or trusted server-side roles)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  AND (
    _user_id = auth.uid()
    OR current_setting('role', true) IN ('service_role', 'postgres')
    OR current_user IN ('service_role', 'postgres', 'supabase_admin')
  )
$function$;

-- 2. Remove EXECUTE from unauthenticated callers and PUBLIC
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- 3. Trigger helper should not be callable through the API at all
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM authenticated;

-- 4. Public photos bucket: consistent read access for all visitors
DROP POLICY IF EXISTS "Public read individual photos" ON storage.objects;
CREATE POLICY "Public read individual photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'photos');