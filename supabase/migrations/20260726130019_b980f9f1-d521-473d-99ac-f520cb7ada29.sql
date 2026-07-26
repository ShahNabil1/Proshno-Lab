ALTER TABLE public.institutes
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.institutes
SET updated_at = COALESCE(last_edited_at, created_at, now())
WHERE updated_at IS NULL;