-- Match CQ duplicates by everything that is rendered on the question paper.
-- Older imports may keep the stem in stimulus_text/question and may contain
-- non-breaking or zero-width spaces, so those representations are unified.
CREATE OR REPLACE FUNCTION public.normalize_duplicate_question_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(COALESCE(_value, ''), chr(160) || chr(8203) || chr(65279), '   '),
          '&(nbsp|#160|#x0*a0);',
          ' ',
          'gi'
        ),
        '<[^>]+>',
        ' ',
        'g'
      ),
      '[[:space:][:punct:]]+',
      '',
      'g'
    )
  );
$$;

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
          public.normalize_duplicate_question_text(COALESCE(
            NULLIF(BTRIM(q.creative_data->>'stem'), ''),
            NULLIF(BTRIM(q.stimulus_text), ''),
            q.question
          )),
          public.normalize_duplicate_question_text(COALESCE(
            NULLIF(q.creative_data->>'q_ka', ''),
            q.creative_data->'sub_questions'->0->>'text',
            q.creative_data->'questions'->0->>'text'
          )),
          public.normalize_duplicate_question_text(COALESCE(
            NULLIF(q.creative_data->>'q_kha', ''),
            q.creative_data->'sub_questions'->1->>'text',
            q.creative_data->'questions'->1->>'text'
          )),
          public.normalize_duplicate_question_text(COALESCE(
            NULLIF(q.creative_data->>'q_ga', ''),
            q.creative_data->'sub_questions'->2->>'text',
            q.creative_data->'questions'->2->>'text'
          )),
          public.normalize_duplicate_question_text(COALESCE(
            NULLIF(q.creative_data->>'q_gha', ''),
            q.creative_data->'sub_questions'->3->>'text',
            q.creative_data->'questions'->3->>'text'
          )))
        WHEN 'descriptive' THEN concat_ws('|', 'desc',
          public.normalize_duplicate_question_text(COALESCE(
            NULLIF(q.creative_data->>'desc_q_ka', ''), q.question
          )),
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

NOTIFY pgrst, 'reload schema';
