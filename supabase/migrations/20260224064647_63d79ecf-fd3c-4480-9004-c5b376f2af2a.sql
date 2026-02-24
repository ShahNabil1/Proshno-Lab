
-- Create topics table
CREATE TABLE public.topics (
  id bigserial PRIMARY KEY,
  chapter_id bigint NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage topics"
  ON public.topics FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read topics"
  ON public.topics FOR SELECT
  USING (true);

-- Add topic_id to questions (nullable for backward compat)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS topic_id bigint REFERENCES public.topics(id) ON DELETE SET NULL;
