-- ============================================================
-- MIGRATION: Create Demo Site and move all test data there
-- ============================================================
-- Run in Supabase Dashboard → SQL Editor
-- Preserves: users, sites, roles, access requests
-- Moves: all entries, photos, batches → new "Demo Site"
-- Clears: all entries from existing sites
-- ============================================================

-- Step 1: Create Demo Site
INSERT INTO sites (name, location) VALUES ('Demo Site', 'Testing / Demo')
RETURNING id;

-- Copy the ID from the result above and paste it into the queries below
-- Example: if the ID is '550e8400-e29b-41d4-a716-446655440000'

-- ============================================================
-- REPLACE 'DEMO_SITE_ID_HERE' WITH THE ACTUAL ID FROM STEP 1
-- ============================================================

-- Step 2: Migrate all entries to Demo Site
UPDATE waste_entries SET site_id = 'DEMO_SITE_ID_HERE' WHERE site_id != 'DEMO_SITE_ID_HERE';

-- Step 3: Update photo storage paths to new site_id
UPDATE waste_entry_photos
SET
  site_id = 'DEMO_SITE_ID_HERE',
  storage_path = REGEXP_REPLACE(storage_path, '^[^/]+', 'DEMO_SITE_ID_HERE', 1, 0)
WHERE site_id != 'DEMO_SITE_ID_HERE';

-- Step 4: Migrate disposal batches
UPDATE disposal_batches SET site_id = 'DEMO_SITE_ID_HERE' WHERE site_id != 'DEMO_SITE_ID_HERE';

-- Step 5: Verify migration
SELECT
  (SELECT COUNT(*) FROM waste_entries WHERE site_id = 'DEMO_SITE_ID_HERE') AS demo_entries,
  (SELECT COUNT(*) FROM waste_entries) AS total_entries,
  (SELECT COUNT(*) FROM waste_entry_photos WHERE site_id = 'DEMO_SITE_ID_HERE') AS demo_photos,
  (SELECT COUNT(*) FROM disposal_batches WHERE site_id = 'DEMO_SITE_ID_HERE') AS demo_batches;

-- Step 6: Clear production sites
DELETE FROM waste_entry_photos WHERE site_id != 'DEMO_SITE_ID_HERE';
DELETE FROM waste_entries WHERE site_id != 'DEMO_SITE_ID_HERE';
DELETE FROM disposal_batches WHERE site_id != 'DEMO_SITE_ID_HERE';

-- Step 7: Final verification
SELECT 'Demo Site' AS label, COUNT(*) AS entries FROM waste_entries WHERE site_id = 'DEMO_SITE_ID_HERE'
UNION ALL
SELECT 'Production Sites' AS label, COUNT(*) AS entries FROM waste_entries WHERE site_id != 'DEMO_SITE_ID_HERE';

-- ============================================================
-- HELPER: Clear Demo Site data (admin can run anytime)
-- ============================================================
-- SELECT clear_demo_site_data();
-- ============================================================

-- Create the cleanup function (run once)
CREATE OR REPLACE FUNCTION clear_demo_site_data()
RETURNS TABLE (
  photos_deleted bigint,
  entries_deleted bigint,
  batches_deleted bigint
) AS $$
DECLARE
  demo_id uuid;
  pd bigint;
  ed bigint;
  bd bigint;
BEGIN
  SELECT id INTO demo_id FROM sites WHERE name = 'Demo Site' LIMIT 1;

  IF demo_id IS NULL THEN
    RAISE NOTICE 'Demo Site not found';
    pd := 0; ed := 0; bd := 0;
    RETURN;
  END IF;

  DELETE FROM waste_entry_photos WHERE site_id = demo_id;
  GET DIAGNOSTICS pd = ROW_COUNT;

  DELETE FROM waste_entries WHERE site_id = demo_id;
  GET DIAGNOSTICS ed = ROW_COUNT;

  DELETE FROM disposal_batches WHERE site_id = demo_id;
  GET DIAGNOSTICS bd = ROW_COUNT;

  RETURN QUERY SELECT pd, ed, bd;
END;
$$ LANGUAGE plpgsql;

-- Verify the function exists
SELECT 'clear_demo_site_data function created' AS status;
