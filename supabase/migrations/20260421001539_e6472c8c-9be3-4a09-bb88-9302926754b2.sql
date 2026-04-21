CREATE OR REPLACE FUNCTION public.normalize_subscription_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(replace(replace(trim(coalesce(value, '')), 'শ্রেণি', ''), '–', '-'), '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.extract_class_levels(value text)
RETURNS integer[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text := public.normalize_subscription_text(value);
  detected integer[] := ARRAY[]::integer[];
  expanded integer[];
BEGIN
  IF normalized LIKE '%ষষ্ঠ%' THEN detected := array_append(detected, 6); END IF;
  IF normalized LIKE '%সপ্তম%' THEN detected := array_append(detected, 7); END IF;
  IF normalized LIKE '%অষ্টম%' THEN detected := array_append(detected, 8); END IF;
  IF normalized LIKE '%নবম%' THEN detected := array_append(detected, 9); END IF;
  IF normalized LIKE '%দশম%' THEN detected := array_append(detected, 10); END IF;
  IF normalized LIKE '%একাদশ%' THEN detected := array_append(detected, 11); END IF;
  IF normalized LIKE '%দ্বাদশ%' THEN detected := array_append(detected, 12); END IF;

  detected := ARRAY(SELECT DISTINCT unnest(detected) ORDER BY 1);

  IF coalesce(array_length(detected, 1), 0) = 2
     AND position('-' in normalized) > 0
     AND position('/' in normalized) = 0
     AND abs(detected[1] - detected[2]) > 1 THEN
    expanded := ARRAY(
      SELECT generate_series(LEAST(detected[1], detected[2]), GREATEST(detected[1], detected[2]))
    );
    RETURN expanded;
  END IF;

  RETURN detected;
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_covers_selection(plan text, class_name text, subject_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_plan text := public.normalize_subscription_text(plan);
  normalized_class text := public.normalize_subscription_text(class_name);
  normalized_subject text := public.normalize_subscription_text(subject_name);
  selected_levels integer[] := public.extract_class_levels(class_name);
  plan_levels integer[] := public.extract_class_levels(plan);
BEGIN
  IF normalized_plan = '' OR normalized_class = '' OR normalized_subject = '' THEN
    RETURN false;
  END IF;

  IF position(normalized_subject in normalized_plan) = 0
     AND position('সকল বিষয়' in normalized_plan) = 0 THEN
    RETURN false;
  END IF;

  IF coalesce(array_length(selected_levels, 1), 0) = 0
     OR coalesce(array_length(plan_levels, 1), 0) = 0 THEN
    RETURN position(normalized_class in normalized_plan) > 0;
  END IF;

  RETURN selected_levels && plan_levels;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_question(_class_id bigint, _subject_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
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

CREATE POLICY "Users can read accessible questions"
ON public.questions
FOR SELECT
TO authenticated
USING (public.can_read_question(class_id, subject_id));