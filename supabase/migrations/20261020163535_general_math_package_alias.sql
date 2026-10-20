CREATE OR REPLACE FUNCTION public.plan_covers_selection(plan text, class_name text, subject_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
 normalized_plan text := public.normalize_subscription_text(plan);
 normalized_class text := public.normalize_subscription_text(class_name);
 normalized_subject text := public.normalize_subscription_text(subject_name);
 selected_levels integer[] := public.extract_class_levels(class_name);
 plan_levels integer[] := public.extract_class_levels(plan);
 general_math_alias boolean;
BEGIN
 IF normalized_plan = '' OR normalized_class = '' OR normalized_subject = '' THEN RETURN false; END IF;
 general_math_alias := normalized_subject IN ('গণিত','সাধারন গণিত','সাধারণ গণিত')
   AND normalized_plan ~ '(^| - )(সাধারন গণিত|সাধারণ গণিত|গণিত)$';
 IF position(normalized_subject in normalized_plan) = 0
    AND position('সকল বিষয়' in normalized_plan) = 0 AND NOT general_math_alias THEN RETURN false; END IF;
 IF coalesce(array_length(selected_levels,1),0)=0 OR coalesce(array_length(plan_levels,1),0)=0 THEN
   RETURN position(normalized_class in normalized_plan)>0;
 END IF;
 RETURN selected_levels && plan_levels;
END; $$;
