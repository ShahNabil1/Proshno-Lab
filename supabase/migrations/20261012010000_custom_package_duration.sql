BEGIN;
ALTER TABLE public.pricing_packages
  ADD COLUMN IF NOT EXISTS subject_ids bigint[],
  ADD COLUMN IF NOT EXISTS duration_days integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pricing_package_duration_positive' AND conrelid='public.pricing_packages'::regclass) THEN
    ALTER TABLE public.pricing_packages ADD CONSTRAINT pricing_package_duration_positive
      CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 36500);
  END IF;
END $$;
-- Existing annual packages retain their original calendar-year expiry.
-- A custom duration is resolved on the server from the purchased package ID.
CREATE OR REPLACE FUNCTION public.apply_package_duration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE days integer;
BEGIN
  IF NEW.bkash_payment_id IS NOT NULL THEN
    SELECT CASE WHEN item ? 'duration_days' THEN (item->>'duration_days')::integer ELSE p.duration_days END INTO days
    FROM public.bkash_payments b
    CROSS JOIN LATERAL jsonb_array_elements(b.selected_packages) item
    JOIN public.pricing_packages p ON p.id=(item->>'id')::bigint
    WHERE b.id=NEW.bkash_payment_id
      AND NEW.plan=(item->>'class_name')||' - '||(item->>'subject_name')
    LIMIT 1;
    IF days IS NOT NULL THEN
      NEW.ends_at := coalesce(NEW.starts_at, now()) + make_interval(days => days);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS subscriptions_package_duration ON public.subscriptions;
CREATE TRIGGER subscriptions_package_duration BEFORE INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.apply_package_duration();
COMMIT;
