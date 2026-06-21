
-- 1. Allow any authenticated user to see all sites (so they can pick one to request access to)
DROP POLICY IF EXISTS "Authenticated can view sites" ON public.sites;
CREATE POLICY "Authenticated can view sites" ON public.sites
  FOR SELECT TO authenticated USING (true);

-- 2. Site access requests table
CREATE TABLE IF NOT EXISTS public.site_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_access_requests TO authenticated;
GRANT ALL ON public.site_access_requests TO service_role;

ALTER TABLE public.site_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own requests"
  ON public.site_access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_site_admin_or_manager(auth.uid(), site_id));

CREATE POLICY "Users insert own pending requests"
  ON public.site_access_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Site admins update requests"
  ON public.site_access_requests FOR UPDATE TO authenticated
  USING (public.is_site_admin_or_manager(auth.uid(), site_id))
  WITH CHECK (public.is_site_admin_or_manager(auth.uid(), site_id));

CREATE POLICY "Users delete own pending requests"
  ON public.site_access_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE TRIGGER trg_site_access_requests_updated
  BEFORE UPDATE ON public.site_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
