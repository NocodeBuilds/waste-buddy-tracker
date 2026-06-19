
-- 1) Delete all admin auth users (cascades to user_roles / user_sites / profiles)
DELETE FROM auth.users
WHERE id IN (SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin');

-- Cleanup any stray rows
DELETE FROM public.user_roles WHERE role = 'admin';

-- 2) Drop wtg_id from waste_entries (location now serves as WTG identifier)
ALTER TABLE public.waste_entries DROP COLUMN IF EXISTS wtg_id;

-- 3) Helper to check if any admin exists (used by the UI to hide claim flow once claimed)
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;
