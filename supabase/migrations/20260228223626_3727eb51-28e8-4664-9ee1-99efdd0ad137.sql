
-- Add is_coming_soon to pricing_packages
ALTER TABLE public.pricing_packages ADD COLUMN is_coming_soon boolean NOT NULL DEFAULT false;

-- Add selected_packages JSONB column to purchase_requests for multi-package orders
ALTER TABLE public.purchase_requests ADD COLUMN selected_packages jsonb DEFAULT '[]'::jsonb;
