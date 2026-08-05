-- ============================================================
-- Security Hardening — RLS Policy Fixes
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- H5 fix: Audit log should only be readable by admins/managers of the SAME site
-- Drop the lax "any admin can read" policy
DROP POLICY IF EXISTS "Admins can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Admins of any site can read audit log" ON audit_log;

-- Create site-scoped read policy
CREATE POLICY "Site admins and managers can read audit log for their site"
ON audit_log
FOR SELECT
TO authenticated
USING (
  site_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.site_id = audit_log.site_id
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- L1 fix: Profiles should only be visible to:
-- 1. The user themselves
-- 2. Admins/managers of sites that BOTH the caller and target user are currently members of
DROP POLICY IF EXISTS "Site admins view requester profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;

CREATE POLICY "Users see own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins see profiles of current site members"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_sites caller_us
    WHERE caller_us.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.site_id = caller_us.site_id
      AND user_roles.role IN ('admin', 'manager')
    )
    AND EXISTS (
      SELECT 1 FROM user_sites target_us
      WHERE target_us.user_id = profiles.id
      AND target_us.site_id = caller_us.site_id
    )
  )
);

-- ============================================================
-- Verification queries
-- ============================================================
-- Check policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('audit_log', 'profiles')
ORDER BY tablename, policyname;
