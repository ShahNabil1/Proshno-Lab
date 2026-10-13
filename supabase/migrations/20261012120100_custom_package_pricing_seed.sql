BEGIN;
-- Reviewed against the existing ProshnoLab catalog on 2026-10-12.
-- Stable IDs deliberately avoid subject-name/code inference at checkout.
-- These inserts affect only new builder configuration, never fixed packages.
INSERT INTO public.custom_package_pricing(class_id,version,class_level,all_package_id,normal_price,special_price,caps,groups,is_active,sort_order)
SELECT seed.class_id,seed.version,seed.level,seed.package_id,
  CASE WHEN seed.level IN ('6','7','8') THEN 299 ELSE 449 END,490,
  CASE WHEN seed.level IN ('6','7','8') THEN '{"2":549,"3":749,"4":899}'::jsonb
    WHEN seed.level='9-10' THEN '{"2":849,"3":1099,"4":1249,"5":1349,"6":1399}'::jsonb
    ELSE '{"2":849,"3":1099,"4":1349,"5":1549,"6":1699,"7":1799}'::jsonb END,
  CASE WHEN seed.level IN ('9-10','11-12') THEN ARRAY['Science','Business Studies','Humanities','Common Subjects'] ELSE '{}'::text[] END,
  true,seed.display_order
FROM (VALUES
  (34,'bangla','6',3,6),(32,'bangla','7',7,7),(33,'bangla','8',11,8),
  (11,'bangla','9-10',15,9),(38,'bangla','11-12',19,11),
  (41,'english','6',34,6),(40,'english','7',33,7),(39,'english','8',32,8),(31,'english','9-10',31,9)
) seed(class_id,version,level,package_id,display_order)
JOIN public.classes c ON c.id=seed.class_id
JOIN public.pricing_packages p ON p.id=seed.package_id
WHERE btrim(public.normalize_subscription_text(c.name))=btrim(public.normalize_subscription_text(p.class_name))
ON CONFLICT(class_id) DO NOTHING;

INSERT INTO public.custom_package_subjects(subject_id,is_special,groups)
SELECT s.id,
  s.id=ANY(ARRAY[159,131,145,243,233,223,74,104,105,106,107,126,212,213,214,197,198,199,200,203,204,205,206,207]::bigint[]),
  CASE
    WHEN s.id=ANY(ARRAY[104,105,106,107,212,213,214,197,198,199,200,204,205,206,207]::bigint[]) THEN ARRAY['Science']
    WHEN s.id=ANY(ARRAY[109,110,111,220,221,222,272,273,274,275,277,278,279,280]::bigint[]) THEN ARRAY['Business Studies']
    WHEN s.id=ANY(ARRAY[113,114,115,116,208,281,282,283,294,295,298,299,300,301,302,303,304,305,308,309,310,311,312,313]::bigint[]) THEN ARRAY['Humanities']
    WHEN s.id=ANY(ARRAY[75,219]::bigint[]) THEN ARRAY['Business Studies','Humanities']
    ELSE '{}'::text[] END
FROM public.subjects s JOIN public.custom_package_pricing cp ON cp.class_id=s.class_id
ON CONFLICT(subject_id) DO NOTHING;
COMMIT;
