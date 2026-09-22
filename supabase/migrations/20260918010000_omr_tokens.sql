-- OMR tokens and evaluations live with the teacher's account instead of a
-- Python engine running on their PC.  Sheets, photos and answer keys are only
-- ever processed inside the browser; this table just remembers the answer key
-- so a teacher can mark sheets from a phone as well as a laptop.

CREATE TABLE IF NOT EXISTS public.omr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'scannable',
  omr_code TEXT,
  columns INTEGER NOT NULL DEFAULT 4,
  number_of_question INTEGER NOT NULL DEFAULT 20,
  negative_marking NUMERIC NOT NULL DEFAULT 0,
  answer_script JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omr_tokens_teacher_idx
  ON public.omr_tokens (teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.omr_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.omr_tokens(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL DEFAULT '',
  image_name TEXT NOT NULL DEFAULT '',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  per_question JSONB NOT NULL DEFAULT '[]'::jsonb,
  processing_time INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omr_evaluations_token_idx
  ON public.omr_evaluations (token_id, created_at DESC);

CREATE INDEX IF NOT EXISTS omr_evaluations_teacher_idx
  ON public.omr_evaluations (teacher_id, created_at DESC);

ALTER TABLE public.omr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omr_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own omr tokens" ON public.omr_tokens;
CREATE POLICY "Teachers manage own omr tokens" ON public.omr_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers manage own omr evaluations" ON public.omr_evaluations;
CREATE POLICY "Teachers manage own omr evaluations" ON public.omr_evaluations
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.omr_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omr_evaluations TO authenticated;

-- keep updated_at honest without a trigger on every write path
CREATE OR REPLACE FUNCTION public.touch_omr_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS omr_tokens_touch ON public.omr_tokens;
CREATE TRIGGER omr_tokens_touch
  BEFORE UPDATE ON public.omr_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_omr_token();
