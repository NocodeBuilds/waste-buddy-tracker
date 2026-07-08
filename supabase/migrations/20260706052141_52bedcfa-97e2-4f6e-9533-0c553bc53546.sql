ALTER TABLE public.waste_entries
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS piece_count INTEGER;

UPDATE public.waste_entries
  SET weight_kg = quantity
  WHERE weight_kg IS NULL;

ALTER TABLE public.waste_entries
  ALTER COLUMN weight_kg SET NOT NULL,
  ALTER COLUMN weight_kg SET DEFAULT 0;

ALTER TABLE public.waste_entries
  ALTER COLUMN quantity DROP NOT NULL;