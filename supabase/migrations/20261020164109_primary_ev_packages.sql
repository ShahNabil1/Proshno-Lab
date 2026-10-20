BEGIN;
ALTER TABLE public.custom_package_pricing DROP CONSTRAINT custom_package_pricing_class_level_check;
ALTER TABLE public.custom_package_pricing ADD CONSTRAINT custom_package_pricing_class_level_check
 CHECK (class_level IN ('3','4','5','6','7','8','9-10','11-12'));
DO $$
DECLARE target record; source public.pricing_packages; package_id bigint;
BEGIN
 FOR target IN SELECT * FROM (VALUES
 ('3','Class 3 (Eglish Version)','তৃতীয় শ্রেণি'),
 ('4','Class 4 (Eglish Version)','চতুর্থ শ্রেণি'),
 ('5','Class 5 (Eglish Version)','পঞ্চম শ্রেণি')
 ) AS targets(level,ev_name,bn_name) LOOP
   SELECT * INTO STRICT source FROM public.pricing_packages
    WHERE class_name=target.bn_name AND type='class' AND subject_name='সকল বিষয়' AND is_active AND subject_ids IS NULL;
   SELECT id INTO package_id FROM public.pricing_packages
    WHERE class_name=target.ev_name AND type='class' AND subject_name='সকল বিষয়' AND subject_ids IS NULL LIMIT 1;
   IF package_id IS NULL THEN
     INSERT INTO public.pricing_packages(type,class_name,subject_name,subject_ids,price,duration_days,is_active,is_coming_soon,sort_order)
     VALUES ('class',target.ev_name,'সকল বিষয়',NULL,source.price,source.duration_days,true,false,source.sort_order)
     RETURNING id INTO package_id;
   END IF;
   INSERT INTO public.custom_package_pricing(class_id,version,class_level,all_package_id,normal_price,special_price,caps,groups,is_active,sort_order)
   SELECT id,'english',target.level,package_id,199,199,'{}'::jsonb,'{}'::text[],true,target.level::integer
   FROM public.classes WHERE name=target.ev_name
   ON CONFLICT (class_id) DO NOTHING;
 END LOOP;
END $$;
COMMIT;
