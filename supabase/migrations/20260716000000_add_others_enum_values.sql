-- Add 'others' to activity_type enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'others';

-- Add 'other_wastes' to waste_category enum
ALTER TYPE public.waste_category ADD VALUE IF NOT EXISTS 'other_wastes';
