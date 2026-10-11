BEGIN;

CREATE OR REPLACE FUNCTION public.question_browser_year(v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  WITH digits AS (SELECT regexp_replace(translate(coalesce(v,''),'০১২৩৪৫৬৭৮৯','0123456789'),'[^0-9]','','g') d)
  SELECT CASE WHEN length(d)>=4 THEN right(d,4) WHEN length(d)=2 THEN '20'||d ELSE '' END FROM digits;
$$;

CREATE OR REPLACE FUNCTION public.question_browser_board(v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 WITH key AS (SELECT lower(regexp_replace(replace(replace(coalesce(v,''),'বোর্ড',''),'বো',''),'[০১২৩৪৫৬৭৮৯0-9.[:space:]''’‘"`,\-–—()]','','g')) k)
 SELECT CASE
 WHEN k IN ('ঢাকা','ঢা','db','dhaka','ঢাকাবোর্ড') THEN 'ঢাকা বোর্ড'
 WHEN k IN ('বরিশাল','ব','bb','barishal','barisal') THEN 'বরিশাল বোর্ড'
 WHEN k IN ('দিনাজপুর','দি','dib','dinajpur') THEN 'দিনাজপুর বোর্ড'
 WHEN k IN ('কুমিল্লা','কু','cub','cumilla','comilla') THEN 'কুমিল্লা বোর্ড'
 WHEN k IN ('যশোর','য','jb','jessore','jashore') THEN 'যশোর বোর্ড'
 WHEN k IN ('সিলেট','সি','sb','sylhet') THEN 'সিলেট বোর্ড'
 WHEN k IN ('রাজশাহী','রা','rb','rajshahi') THEN 'রাজশাহী বোর্ড'
 WHEN k IN ('ময়মনসিংহ','ম','mb','mymensingh') THEN 'ময়মনসিংহ বোর্ড'
 WHEN k IN ('চট্টগ্রাম','চ','ctg','chattogram','chittagong') THEN 'চট্টগ্রাম বোর্ড'
 ELSE NULL END FROM key;
$$;

CREATE OR REPLACE FUNCTION public.question_browser_creative_text(v jsonb, k text DEFAULT '')
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE result text; BEGIN
  IF v IS NULL OR k ~* '^(id|answer|answers|explanation|correct_answer|ans_|desc_ans_|marks?|created_at|updated_at)' THEN RETURN ''; END IF;
  IF jsonb_typeof(v) IN ('string','number') THEN RETURN v #>> '{}'; END IF;
  IF jsonb_typeof(v)='array' THEN
    SELECT string_agg(public.question_browser_creative_text(value,k),' ' ORDER BY ordinality) INTO result FROM jsonb_array_elements(v) WITH ORDINALITY;
  ELSIF jsonb_typeof(v)='object' THEN
    SELECT string_agg(public.question_browser_creative_text(value,key),' ' ORDER BY key) INTO result FROM jsonb_each(v);
  END IF;
  RETURN coalesce(result,'');
END; $$;

CREATE OR REPLACE FUNCTION public.question_browser_signature(v text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE t text := normalize(coalesce(v,''),NFKC); BEGIN
 t := regexp_replace(t,'<img[^>]*src=["'']([^"'']+)["''][^>]*>',' image:\1 ','gi');
 t := regexp_replace(t,'<br[[:space:]]*/?>',' ','gi');
 t := regexp_replace(t,'<[^>]*>','','g');
 t := regexp_replace(t,'&(nbsp|ensp|emsp|thinsp);|&#160;',' ','gi');
 t := replace(replace(replace(t,'&amp;','&'),'&lt;','<'),'&gt;','>');
 t := translate(t,chr(8203)||chr(8204)||chr(8205)||chr(8288)||chr(65279),'');
 t := regexp_replace(t,'\\(left|right|displaystyle|textstyle)','','gi');
 t := regexp_replace(t,'\\[a-z]+','','gi');
 RETURN lower(regexp_replace(t,'[^[:alnum:]+\-=/<>%]','','g'));
END; $$;

CREATE OR REPLACE FUNCTION public.question_browser_latest_year(br jsonb, ur jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT coalesce(max(public.question_browser_year(x->>'year')),'')
 FROM jsonb_array_elements(
  CASE WHEN jsonb_typeof(br)='array' THEN br ELSE '[]' END ||
  CASE WHEN jsonb_typeof(ur)='array' THEN ur ELSE '[]' END
 ) x;
$$;

-- Incremental backfill avoids rewriting/locking the entire question table.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS browser_year text,
 ADD COLUMN IF NOT EXISTS browser_key text;
CREATE OR REPLACE FUNCTION public.question_browser_update_metadata()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
 NEW.browser_year := public.question_browser_latest_year(NEW.board_references,NEW.university_references);
 NEW.browser_key := NEW.type||'::'||public.question_browser_signature(coalesce(NEW.question,'')||' '||coalesce(NEW.stimulus_text,'')||' '||
  CASE WHEN NEW.type IN ('cq','creative','descriptive') OR public.question_browser_signature(NEW.question)=''
  THEN public.question_browser_creative_text(NEW.creative_data) ELSE '' END);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS question_browser_metadata ON public.questions;
CREATE TRIGGER question_browser_metadata BEFORE INSERT OR UPDATE OF question,type,stimulus_text,creative_data,board_references,university_references
 ON public.questions FOR EACH ROW EXECUTE FUNCTION public.question_browser_update_metadata();
CREATE INDEX IF NOT EXISTS idx_questions_browser_scope ON public.questions(subject_id,class_id,chapter_id,type,browser_year DESC,id DESC);

-- Runs with the caller's permissions and existing question/chapter RLS.
-- Only the requested page of complete questions leaves the database.
CREATE OR REPLACE FUNCTION public.question_browser_page(_scope jsonb, _filters jsonb DEFAULT '{}', _page integer DEFAULT 1)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH raw AS MATERIALIZED (
  SELECT q.id,q.type,q.chapter_id,q.topic_id,q.question,q.option_a,q.option_b,q.option_c,q.option_d,
    q.stimulus_group_id,q.stimulus_text,q.creative_data,
    coalesce(q.browser_key,q.type||'::'||public.question_browser_signature(coalesce(q.question,'')||' '||coalesce(q.stimulus_text,'')||' '||
      CASE WHEN q.type IN ('cq','creative','descriptive') OR public.question_browser_signature(q.question)='' THEN public.question_browser_creative_text(q.creative_data) ELSE '' END)) browser_key,
    coalesce(q.browser_year,public.question_browser_latest_year(q.board_references,q.university_references)) browser_year,
    CASE WHEN jsonb_typeof(q.board_references)='array' THEN q.board_references ELSE '[]' END br,
    CASE WHEN jsonb_typeof(q.university_references)='array' THEN q.university_references ELSE '[]' END ur
  FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
  WHERE q.class_id = ANY (ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(_scope->'classIds')))
    AND q.subject_id = ANY (ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(_scope->'subjectIds')))
    AND q.chapter_id = ANY (ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(_scope->'chapterIds')))
    AND (coalesce((_scope->>'includeInactive')::boolean,false) OR c.is_active)
    AND (coalesce(jsonb_array_length(_scope->'types'),0)=0 OR q.type IN (SELECT value FROM jsonb_array_elements_text(_scope->'types')))
), ranked AS MATERIALIZED (
  SELECT r.*, browser_year yr,
    row_number() OVER (PARTITION BY browser_key ORDER BY browser_year DESC,id DESC) rn
  FROM raw r
), pool AS MATERIALIZED (SELECT * FROM ranked WHERE rn=1), refs AS MATERIALIZED (
  SELECT p.id,btrim(coalesce(x->>'board',x->>'name','')) name,
    public.question_browser_board(x->>'board') board,
    public.question_browser_year(x->>'year') board_year,
    coalesce(nullif(public.question_browser_year(x->>'year'),''),
      public.question_browser_year(substring(translate(coalesce(x->>'board',x->>'name',''),'০১২৩৪৫৬৭৮৯','0123456789') FROM '(?:19|20)[0-9]{2}|[''’][[:space:]]*[0-9]{2}'))) school_year,
    public.question_browser_board(coalesce(x->>'board',x->>'name','')) IS NULL
      AND coalesce(x->>'board',x->>'name','') !~* 'বোর্ড'
      AND coalesce(x->>'board',x->>'name','') ~* '(স্কুল|কলেজ|বিদ্যালয়|বিদ্যালয়|ক্যাডেট|একাডেমি|মাদ্রাসা|ইনস্টিটিউট|school|college|academy|institute|madras)' school,
    n <= jsonb_array_length(p.br) is_board_ref
  FROM pool p CROSS JOIN LATERAL jsonb_array_elements(p.br||p.ur) WITH ORDINALITY a(x,n)
), typed AS MATERIALIZED (
  SELECT * FROM pool WHERE coalesce(_filters->>'type','')='' OR type=_filters->>'type'
), non_type_filtered AS MATERIALIZED (
  SELECT p.* FROM pool p WHERE
    (coalesce(_filters->>'search','')='' OR position(lower(_filters->>'search') in lower(p.question))>0)
    AND (coalesce(jsonb_array_length(_filters->'chapterIds'),0)=0 OR p.chapter_id IN (SELECT value::bigint FROM jsonb_array_elements_text(_filters->'chapterIds')))
    AND ((coalesce(jsonb_array_length(_filters->'topicIds'),0)=0 AND coalesce(jsonb_array_length(_filters->'untopicedChapterIds'),0)=0)
      OR p.topic_id IN (SELECT value::bigint FROM jsonb_array_elements_text(_filters->'topicIds'))
      OR (p.topic_id IS NULL AND p.chapter_id IN (SELECT value::bigint FROM jsonb_array_elements_text(_filters->'untopicedChapterIds'))))
    AND ((coalesce(jsonb_array_length(_filters->'boards'),0)=0 AND coalesce(_filters->>'year','')='') OR EXISTS (
      SELECT 1 FROM refs r WHERE r.id=p.id AND r.is_board_ref AND r.board IS NOT NULL
      AND (coalesce(jsonb_array_length(_filters->'boards'),0)=0 OR r.board IN (SELECT value FROM jsonb_array_elements_text(_filters->'boards')))
      AND (coalesce(_filters->>'year','')='' OR r.board_year=_filters->>'year')))
    AND ((coalesce(jsonb_array_length(_filters->'schools'),0)=0 AND coalesce(_filters->>'schoolYear','')='') OR EXISTS (
      SELECT 1 FROM refs r WHERE r.id=p.id AND r.school
      AND (coalesce(jsonb_array_length(_filters->'schools'),0)=0 OR r.name IN (SELECT value FROM jsonb_array_elements_text(_filters->'schools')))
      AND (coalesce(_filters->>'schoolYear','')='' OR r.school_year=_filters->>'schoolYear')))
    AND CASE coalesce(_filters->>'special','')
      WHEN 'board' THEN (SELECT count(DISTINCT coalesce(r.board,r.name)) FROM refs r WHERE r.id=p.id AND r.is_board_ref AND r.name<>'')>=2
      WHEN 'math' THEN concat_ws(' ',p.question,p.option_a,p.option_b,p.option_c,p.option_d,p.stimulus_text) ~* E'\\\\(frac|sqrt|sum|int|times|div|pm|leq|geq|neq|alpha|beta|theta|pi)|\\$.*?\\$|\\\\[\\[\\]()]'
      WHEN 'theoretical' THEN concat_ws(' ',p.question,p.option_a,p.option_b,p.option_c,p.option_d) !~* E'\\\\(frac|sqrt|sum|int)|\\$.*?\\$'
      WHEN 'diagram' THEN concat_ws(' ',p.question,p.option_a,p.option_b,p.option_c,p.option_d,p.stimulus_text) ~* '<img[[:space:]]|cloudinary\.com|res\.cloudinary'
      WHEN 'multi_completion' THEN p.type='mcq' AND (regexp_replace(p.question,'<[^>]*>','','g') ~ '(?:^|[^a-zA-Z])i[.[:space:]].*(?:^|[^a-zA-Z])ii[.[:space:]].*(?:^|[^a-zA-Z])iii[.[:space:]]' OR regexp_replace(p.question,'<[^>]*>','','g') ~ '(?:^|[^a-zA-Z])i\).*(?:^|[^a-zA-Z])ii\).*(?:^|[^a-zA-Z])iii\)')
      WHEN 'assertion' THEN jsonb_array_length(p.br)>=1
      ELSE true END
), filtered AS MATERIALIZED (
  SELECT * FROM non_type_filtered WHERE coalesce(_filters->>'type','')='' OR type=_filters->>'type'
), topic_pool AS MATERIALIZED (
  SELECT * FROM typed WHERE coalesce(jsonb_array_length(_filters->'chapterIds'),0)=0 OR chapter_id IN (SELECT value::bigint FROM jsonb_array_elements_text(_filters->'chapterIds'))
), page_ids AS MATERIALIZED (SELECT id,yr FROM filtered ORDER BY yr DESC,id DESC LIMIT 20 OFFSET (greatest(1,_page)-1)*20), page_rows AS MATERIALIZED (SELECT * FROM public.questions WHERE id = ANY (ARRAY(SELECT id FROM page_ids)))
SELECT jsonb_build_object(
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(q)-'browser_key'-'browser_year' ORDER BY p.yr DESC,q.id DESC) FROM page_ids p JOIN page_rows q ON q.id=p.id),'[]'),
  'total',(SELECT count(*) FROM filtered),
  'types',coalesce((SELECT jsonb_object_agg(type,n) FROM (SELECT type,count(*) n FROM pool GROUP BY type) a),'{}'),
  'filterTypes',coalesce((SELECT jsonb_object_agg(type,n) FROM (SELECT type,count(*) n FROM non_type_filtered GROUP BY type) a),'{}'),
  'chapters',coalesce((SELECT jsonb_object_agg(chapter_id,n) FROM (SELECT chapter_id,count(*) n FROM typed GROUP BY chapter_id) a),'{}'),
  'topics',coalesce((SELECT jsonb_object_agg(topic_id,n) FROM (SELECT topic_id,count(*) n FROM topic_pool WHERE topic_id IS NOT NULL GROUP BY topic_id) a),'{}'),
  'untopiced',coalesce((SELECT jsonb_object_agg(chapter_id,n) FROM (SELECT chapter_id,count(*) n FROM topic_pool WHERE topic_id IS NULL GROUP BY chapter_id) a),'{}'),
  'topicChapters',coalesce((SELECT jsonb_object_agg(chapter_id,n) FROM (SELECT chapter_id,count(*) n FROM topic_pool GROUP BY chapter_id) a),'{}'),
  'schools',coalesce((SELECT jsonb_agg(name ORDER BY name) FROM (SELECT DISTINCT name FROM refs WHERE school) a),'[]'),
  'boardYears',coalesce((SELECT jsonb_agg(board_year ORDER BY board_year DESC) FROM (SELECT DISTINCT board_year FROM refs WHERE board IS NOT NULL AND is_board_ref AND board_year<>'') a),'[]'),
  'schoolYears',coalesce((SELECT jsonb_agg(school_year ORDER BY school_year DESC) FROM (SELECT DISTINCT school_year FROM refs WHERE school AND school_year<>'') a),'[]')
);
$$;
COMMIT;
