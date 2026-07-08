
-- Add 5s activity value to enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS '5s';

-- Allow site admins/managers to view profiles of users who have pending
-- site access requests to their site (so requests list shows names, not UUIDs).
CREATE POLICY "Site admins view requester profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.site_access_requests r
    WHERE r.user_id = profiles.id
      AND public.is_site_admin_or_manager(auth.uid(), r.site_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.user_sites us1
    JOIN public.user_sites us2 ON us1.site_id = us2.site_id
    WHERE us1.user_id = auth.uid()
      AND us2.user_id = profiles.id
      AND public.is_site_admin_or_manager(auth.uid(), us1.site_id)
  )
);
