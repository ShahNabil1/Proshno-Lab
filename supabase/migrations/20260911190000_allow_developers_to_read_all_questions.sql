-- Admins and developers need complete question-bank visibility for local and
-- preview QA. Authentication is still required; anonymous users remain limited
-- to the existing free-chapter policy.
CREATE OR REPLACE FUNCTION public.can_read_question(
  _class_id bigint,
  _subject_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'developer'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.class_id = _class_id
        AND up.subject_id = _subject_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.subscriptions sub
      JOIN public.classes cls ON cls.id = _class_id
      JOIN public.subjects subj ON subj.id = _subject_id
      WHERE sub.teacher_id = auth.uid()
        AND sub.status = 'active'
        AND public.plan_covers_selection(sub.plan, cls.name, subj.name)
    );
$$;

