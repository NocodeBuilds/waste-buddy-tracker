
CREATE TABLE IF NOT EXISTS public.site_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text,
  is_common boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_locations_site_code_uniq
  ON public.site_locations(site_id, code) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_locations_common_code_uniq
  ON public.site_locations(code) WHERE site_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_locations TO authenticated;
GRANT ALL ON public.site_locations TO service_role;

ALTER TABLE public.site_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View site or common locations"
ON public.site_locations FOR SELECT TO authenticated
USING (
  is_common = true
  OR (site_id IS NOT NULL AND public.has_site_access(auth.uid(), site_id))
);

CREATE POLICY "Admins insert locations"
ON public.site_locations FOR INSERT TO authenticated
WITH CHECK (
  (site_id IS NOT NULL AND public.has_site_role(auth.uid(), site_id, 'admin'))
  OR (is_common = true AND public.is_any_admin(auth.uid()))
);
CREATE POLICY "Admins update locations"
ON public.site_locations FOR UPDATE TO authenticated
USING (
  (site_id IS NOT NULL AND public.has_site_role(auth.uid(), site_id, 'admin'))
  OR (is_common = true AND public.is_any_admin(auth.uid()))
);
CREATE POLICY "Admins delete locations"
ON public.site_locations FOR DELETE TO authenticated
USING (
  (site_id IS NOT NULL AND public.has_site_role(auth.uid(), site_id, 'admin'))
  OR (is_common = true AND public.is_any_admin(auth.uid()))
);

CREATE TRIGGER trg_site_locations_updated
BEFORE UPDATE ON public.site_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sites (name, location) VALUES
  ('Molagavalli 1 & 2', 'Andhra Pradesh'),
  ('Nimbagallu',        'Andhra Pradesh'),
  ('Kalayandurga',      'Andhra Pradesh')
ON CONFLICT DO NOTHING;

-- Common locations (skip if already there)
INSERT INTO public.site_locations (site_id, code, is_common, sort_order)
SELECT NULL, v.code, true, v.so
FROM (VALUES ('Hazardous Shed',1),('PSS',2),('HT Yard',3)) AS v(code, so)
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_locations sl WHERE sl.site_id IS NULL AND sl.code = v.code
);

-- Per-site seeds via plain SQL (no loops)
WITH s AS (
  SELECT id, name FROM public.sites
  WHERE name IN ('Molagavalli 1 & 2','Nimbagallu','Kalayandurga')
),
mol_kctre AS (
  SELECT (SELECT id FROM s WHERE name='Molagavalli 1 & 2') AS site_id,
         'KCTRE' || lpad(g::text, 2, '0') AS code,
         g AS sort_order
  FROM generate_series(1,20) g
),
mol_gml AS (
  SELECT (SELECT id FROM s WHERE name='Molagavalli 1 & 2') AS site_id,
         'GML' || n::text AS code,
         100 + row_number() OVER () AS sort_order
  FROM unnest(ARRAY[22,24,45,49,50,51,52,53,54,55,56,57,58,59,60,61,70,71,72,73,74,139]) AS n
),
nim AS (
  SELECT (SELECT id FROM s WHERE name='Nimbagallu') AS site_id,
         'G2-' || n::text AS code,
         row_number() OVER () AS sort_order
  FROM unnest(ARRAY[22,23,24,25,31,32,33,34,50,51,52,53,54,55]) AS n
),
kal AS (
  SELECT (SELECT id FROM s WHERE name='Kalayandurga') AS site_id,
         'KCT' || lpad(g::text, 2, '0') AS code,
         g AS sort_order
  FROM generate_series(1,12) g
),
all_rows AS (
  SELECT * FROM mol_kctre
  UNION ALL SELECT * FROM mol_gml
  UNION ALL SELECT * FROM nim
  UNION ALL SELECT * FROM kal
)
INSERT INTO public.site_locations (site_id, code, sort_order)
SELECT site_id, code, sort_order FROM all_rows
WHERE site_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.waste_entries
  ADD COLUMN IF NOT EXISTS location text;

CREATE INDEX IF NOT EXISTS idx_waste_entries_location
  ON public.waste_entries(site_id, location);
