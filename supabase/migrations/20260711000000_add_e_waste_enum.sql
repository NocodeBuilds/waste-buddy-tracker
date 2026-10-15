-- Add e_waste to the waste_category enum
ALTER TYPE public.waste_category ADD VALUE IF NOT EXISTS 'e_waste';
