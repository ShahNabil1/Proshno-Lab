BEGIN;
CREATE OR REPLACE FUNCTION public.extract_class_levels(value text) RETURNS integer[] LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  normalized text := public.normalize_subscription_text(value);
  detected integer[] := ARRAY[]::integer[];
  expanded integer[];
BEGIN
  IF normalized LIKE '%তৃতীয়%' THEN detected := array_append(detected, 3); END IF;
  IF normalized LIKE '%তৃতীয়%' THEN detected := array_append(detected, 3); END IF;
  IF normalized LIKE '%চতুর্থ%' THEN detected := array_append(detected, 4); END IF;
  IF normalized LIKE '%পঞ্চম%' THEN detected := array_append(detected, 5); END IF;
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
    expanded := ARRAY(SELECT generate_series(LEAST(detected[1], detected[2]), GREATEST(detected[1], detected[2])));
    RETURN expanded;
  END IF;
  RETURN detected;
END; $$;
COMMIT;
