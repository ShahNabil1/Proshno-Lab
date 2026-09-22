-- Dashboard stats without storing the generated papers themselves:
-- two running totals per teacher keep the database tiny.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS generated_sets integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_questions bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_generated_paper(q_count integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  added integer := GREATEST(COALESCE(q_count, 0), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.teachers (id, generated_sets, generated_questions)
  VALUES (auth.uid(), 1, added)
  ON CONFLICT (id) DO UPDATE
    SET generated_sets = public.teachers.generated_sets + 1,
        generated_questions = public.teachers.generated_questions + added;
END;
$$;

REVOKE ALL ON FUNCTION public.record_generated_paper(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_generated_paper(integer) TO authenticated;
