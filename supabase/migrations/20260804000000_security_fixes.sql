-- ============================================================
-- Security fixes (H5, L1)
-- ============================================================
-- H5: Audit log should only be readable by admins of the SAME site.
-- L1: Profile PII visible to admins across multiple sites — already implicitly
--     covered by the explicit policy below.
-- ============================================================

-- H5 fix: tighten audit_log read policy to be site-scoped
DROP POLICY IF EXISTS "Admins can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Admins of any site can read audit log" ON audit_log;

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

-- L1 fix: tighten profiles select policy so admins only see members of sites
-- they're currently a member of (avoids seeing users who left their site).
-- Drop any existing lax policies and replace with a strict one.
DROP POLICY IF EXISTS "Site admins view requester profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;

CREATE POLICY "Admins see profiles of current site members"
ON profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()  -- always see your own profile
  OR EXISTS (
    -- Caller is admin/manager of a site that BOTH they and the target user are currently members of
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
-- L2 fix: CSV formula injection — no DB change, but document
-- the canonical CSV escaper used in the client (SettingsTab.tsx).
-- ============================================================

-- ============================================================
-- M8: rate limiting hint
-- Note: rate limiting is best handled at the edge / function layer.
-- ============================================================
