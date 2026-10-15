-- Migration: 20261016000000_regions_and_states_hierarchy.sql
-- Description: Multi-Region and State hierarchy for WasteBuddy enterprise facilities

BEGIN;

-- 1. Create Regions Table
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on regions
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- Read policy: Any authenticated operator can view regions
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view regions" ON public.regions;
  CREATE POLICY "Authenticated users can view regions" ON public.regions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Write policy: Only admins can manage regions
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage regions" ON public.regions;
  CREATE POLICY "Admins can manage regions" ON public.regions
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. Add Region & State attributes to Sites table
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Indexes for fast regional querying
CREATE INDEX IF NOT EXISTS idx_sites_region_id ON public.sites(region_id);
CREATE INDEX IF NOT EXISTS idx_sites_state ON public.sites(state);
CREATE INDEX IF NOT EXISTS idx_regions_state ON public.regions(state);

-- 3. Seed Default Regional Hierarchy (Idempotent)
INSERT INTO public.regions (name, state, code)
SELECT 'Western Maharashtra Industrial Corridor', 'Maharashtra', 'MH-WEST'
WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE code = 'MH-WEST');

INSERT INTO public.regions (name, state, code)
SELECT 'Gujarat Petrochemical & Special Economic Zone', 'Gujarat', 'GJ-SEZ'
WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE code = 'GJ-SEZ');

INSERT INTO public.regions (name, state, code)
SELECT 'Karnataka Tech & Manufacturing Belt', 'Karnataka', 'KA-MFG'
WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE code = 'KA-MFG');

INSERT INTO public.regions (name, state, code)
SELECT 'Tamil Nadu Auto & Electronics Cluster', 'Tamil Nadu', 'TN-AUTO'
WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE code = 'TN-AUTO');

COMMIT;
