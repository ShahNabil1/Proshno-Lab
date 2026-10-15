BEGIN;
-- Preserve expiry, manual grants, custom purchases and legacy bundle matching.
CREATE OR REPLACE FUNCTION public.can_read_question(_class_id bigint,_subject_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.subjects WHERE id=_subject_id AND class_id=_class_id) AND (
   public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer')
   OR EXISTS(SELECT 1 FROM public.user_permissions WHERE user_id=auth.uid() AND class_id=_class_id AND subject_id=_subject_id)
   OR EXISTS(SELECT 1 FROM public.custom_package_purchases pu JOIN public.subscriptions sub ON sub.id=pu.subscription_id
     WHERE pu.user_id=auth.uid() AND pu.class_id=_class_id AND _subject_id=ANY(pu.subject_ids)
       AND sub.status='active' AND sub.starts_at<=now() AND sub.ends_at>now())
   OR EXISTS(SELECT 1 FROM public.subscriptions sub JOIN public.classes c ON c.id=_class_id JOIN public.subjects s ON s.id=_subject_id
     WHERE sub.teacher_id=auth.uid() AND sub.package_type='fixed' AND sub.status='active'
       AND (sub.starts_at IS NULL OR sub.starts_at<=now()) AND (sub.ends_at IS NULL OR sub.ends_at>now())
       AND CASE
         -- Fixed packages with explicit subjects must use the checkout snapshot.
         -- Display labels may be shortened, translated or edited later.
         WHEN EXISTS (
           SELECT 1 FROM public.bkash_payments b
           CROSS JOIN LATERAL jsonb_array_elements(b.selected_packages) item
           WHERE b.id=sub.bkash_payment_id AND b.user_id=sub.teacher_id
             AND sub.plan=(item->>'class_name')||' - '||(item->>'subject_name')
             AND jsonb_typeof(item->'subject_ids')='array'
         ) THEN EXISTS (
           SELECT 1 FROM public.bkash_payments b
           CROSS JOIN LATERAL jsonb_array_elements(b.selected_packages) item
           CROSS JOIN LATERAL jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(item->'subject_ids')='array'
               THEN item->'subject_ids' ELSE '[]'::jsonb END
           ) purchased_subject(id)
           WHERE b.id=sub.bkash_payment_id AND b.user_id=sub.teacher_id
             AND sub.plan=(item->>'class_name')||' - '||(item->>'subject_name')
             AND purchased_subject.id=_subject_id::text
         )
         ELSE public.plan_covers_selection(sub.plan,c.name,s.name)
       END));
$$;
COMMIT;
