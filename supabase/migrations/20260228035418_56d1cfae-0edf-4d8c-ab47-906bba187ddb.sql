
-- Allow anyone to read questions from free (demo) chapters
CREATE POLICY "Anyone can read free chapter questions"
ON public.questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chapters
    WHERE chapters.id = questions.chapter_id
    AND chapters.is_free = true
    AND chapters.is_active = true
  )
);
