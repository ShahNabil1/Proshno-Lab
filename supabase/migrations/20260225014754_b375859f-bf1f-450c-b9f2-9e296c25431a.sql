
-- Add phone and specific_address fields to institutes
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS specific_address text DEFAULT '';
