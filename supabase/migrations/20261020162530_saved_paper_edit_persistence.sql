-- Edits belong to the teacher's own saved paper; source questions stay unchanged.
CREATE POLICY "Teachers can update own papers"
ON public.saved_papers FOR UPDATE TO authenticated
USING ((select auth.uid()) = teacher_id)
WITH CHECK ((select auth.uid()) = teacher_id);
