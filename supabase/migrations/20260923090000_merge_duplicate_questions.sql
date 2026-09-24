-- Safely merge duplicate question rows into one canonical question.
CREATE OR REPLACE FUNCTION public.merge_duplicate_questions(
  _keep_id bigint,
  _delete_ids bigint[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_delete_ids bigint[];
  deleted_count integer := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'developer'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = _keep_id) THEN
    RAISE EXCEPTION 'Main question % was not found', _keep_id;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT id), '{}'::bigint[])
  INTO safe_delete_ids
  FROM unnest(COALESCE(_delete_ids, '{}'::bigint[])) AS id
  WHERE id <> _keep_id;

  IF cardinality(safe_delete_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- Preserve reports by moving them to the canonical question.
  UPDATE public.question_reports
  SET question_id = _keep_id
  WHERE question_id = ANY(safe_delete_ids);

  -- Preserve saved papers and collapse repeated IDs after remapping.
  UPDATE public.saved_papers AS p
  SET question_ids = (
    SELECT COALESCE(array_agg(d.question_id ORDER BY d.first_position), '{}'::bigint[]) AS ids
    FROM (
      SELECT
        CASE WHEN u.question_id = ANY(safe_delete_ids) THEN _keep_id ELSE u.question_id END AS question_id,
        min(u.position) AS first_position
      FROM unnest(p.question_ids) WITH ORDINALITY AS u(question_id, position)
      GROUP BY CASE WHEN u.question_id = ANY(safe_delete_ids) THEN _keep_id ELSE u.question_id END
    ) AS d
  )
  WHERE p.question_ids && safe_delete_ids;

  -- Suggestions also store question IDs in an array.
  UPDATE public.suggestions AS s
  SET question_ids = (
    SELECT COALESCE(array_agg(d.question_id ORDER BY d.first_position), '{}'::bigint[]) AS ids
    FROM (
      SELECT
        CASE WHEN u.question_id = ANY(safe_delete_ids) THEN _keep_id ELSE u.question_id END AS question_id,
        min(u.position) AS first_position
      FROM unnest(s.question_ids) WITH ORDINALITY AS u(question_id, position)
      GROUP BY CASE WHEN u.question_id = ANY(safe_delete_ids) THEN _keep_id ELSE u.question_id END
    ) AS d
  )
  WHERE s.question_ids && safe_delete_ids;

  DELETE FROM public.questions
  WHERE id = ANY(safe_delete_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_questions(bigint, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_questions(bigint, bigint[]) TO authenticated;

-- Normalize rich question text consistently for duplicate grouping.
CREATE OR REPLACE FUNCTION public.normalize_duplicate_question_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(COALESCE(_value, ''), '<[^>]+>', ' ', 'g'),
      '[[:space:]।.,;:''"“”‘’()\[\]{}\-–—_*`~!?]+',
      '',
      'g'
    )
  );
$$;

-- Server-side duplicate scan; filters are optional and the result is paginated by group.
CREATE OR REPLACE FUNCTION public.find_duplicate_question_groups(
  _class_id bigint DEFAULT NULL,
  _subject_id bigint DEFAULT NULL,
  _chapter_id bigint DEFAULT NULL,
  _type text DEFAULT NULL,
  _limit integer DEFAULT 200,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  signature text,
  keep_id bigint,
  duplicate_ids bigint[],
  occurrences jsonb,
  total_groups bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'developer'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  WITH normalized AS (
    SELECT
      q.*,
      md5(CASE q.type
        WHEN 'mcq' THEN concat_ws('|', 'mcq',
          public.normalize_duplicate_question_text(q.question),
          public.normalize_duplicate_question_text(q.option_a),
          public.normalize_duplicate_question_text(q.option_b),
          public.normalize_duplicate_question_text(q.option_c),
          public.normalize_duplicate_question_text(q.option_d))
        WHEN 'cq' THEN concat_ws('|', 'cq',
          public.normalize_duplicate_question_text(q.creative_data->>'stem'),
          public.normalize_duplicate_question_text(q.creative_data->>'q_ka'),
          public.normalize_duplicate_question_text(q.creative_data->>'q_kha'))
        WHEN 'descriptive' THEN concat_ws('|', 'desc',
          public.normalize_duplicate_question_text(q.creative_data->>'desc_q_ka'),
          public.normalize_duplicate_question_text(q.creative_data->>'desc_q_kha'))
        ELSE concat_ws('|', 'short', public.normalize_duplicate_question_text(q.question))
      END) AS duplicate_signature
    FROM public.questions q
    WHERE (_class_id IS NULL OR q.class_id = _class_id)
      AND (_subject_id IS NULL OR q.subject_id = _subject_id)
      AND (_chapter_id IS NULL OR q.chapter_id = _chapter_id)
      AND (_type IS NULL OR q.type = _type)
  ), grouped AS (
    SELECT
      n.duplicate_signature,
      min(n.id) AS canonical_id,
      (array_agg(n.id ORDER BY n.id))[2:] AS extra_ids,
      jsonb_agg(jsonb_build_object(
        'id', n.id,
        'type', n.type,
        'question', n.question,
        'creative_data', n.creative_data,
        'class_id', n.class_id,
        'subject_id', n.subject_id,
        'chapter_id', n.chapter_id,
        'created_at', n.created_at
      ) ORDER BY n.id) AS group_rows
    FROM normalized n
    GROUP BY n.duplicate_signature
    HAVING count(*) > 1
  )
  SELECT
    g.duplicate_signature,
    g.canonical_id,
    g.extra_ids,
    g.group_rows,
    count(*) OVER ()
  FROM grouped g
  ORDER BY cardinality(g.extra_ids) DESC, g.canonical_id
  LIMIT LEAST(GREATEST(_limit, 1), 1000)
  OFFSET GREATEST(_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_question_groups(bigint, bigint, bigint, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_question_groups(bigint, bigint, bigint, text, integer, integer) TO authenticated;
ALTER FUNCTION public.find_duplicate_question_groups(bigint, bigint, bigint, text, integer, integer)
  SET statement_timeout = '120s';
