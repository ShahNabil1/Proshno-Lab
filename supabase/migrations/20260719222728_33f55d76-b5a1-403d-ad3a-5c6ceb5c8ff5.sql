
GRANT SELECT ON public.chapters TO anon;
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT ON public.classes TO anon;
GRANT SELECT ON public.questions TO anon;

CREATE POLICY "Anon can read free active chapters"
ON public.chapters FOR SELECT TO anon
USING (is_free = true AND is_active = true);

CREATE POLICY "Anon can read subjects"
ON public.subjects FOR SELECT TO anon
USING (true);

CREATE POLICY "Anon can read classes"
ON public.classes FOR SELECT TO anon
USING (true);

CREATE POLICY "Anon can read questions in free chapters"
ON public.questions FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.chapters c WHERE c.id = questions.chapter_id AND c.is_free = true AND c.is_active = true));
