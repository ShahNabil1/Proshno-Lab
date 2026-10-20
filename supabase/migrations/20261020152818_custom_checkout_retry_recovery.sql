-- Service-only reservation: retain the lock and ownership/price checks.
-- A caller may bypass an old attempt only after the authenticated edge function
-- has queried bKash and verified it is unpaid. Unknown/settled attempts still block.
CREATE OR REPLACE FUNCTION public.reserve_custom_payment(context jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE buyer uuid:=(context->>'user_id')::uuid; item jsonb:=context->'selected_packages'->0; id bigint; fresh jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(buyer::text,0));
 fresh:=public.quote_custom_package(item,buyer);
 IF jsonb_array_length(fresh->'owned_subject_ids')>0 THEN RAISE EXCEPTION 'Selected subjects are already owned'; END IF;
 IF (fresh->>'price')::numeric IS DISTINCT FROM (item->>'price')::numeric THEN RAISE EXCEPTION 'Pricing changed; refresh quote'; END IF;
 IF EXISTS(SELECT 1 FROM public.bkash_payments b CROSS JOIN LATERAL jsonb_array_elements(b.selected_packages) p
   WHERE b.user_id=buyer AND b.status='initiated' AND p->>'kind'='custom'
     AND b.environment IS NOT DISTINCT FROM context->>'environment'
     AND NOT (
       b.id IN (SELECT value::bigint FROM jsonb_array_elements_text(coalesce(context->'verified_unpaid_payment_ids','[]'::jsonb)))
       AND b.trx_id IS NULL
       AND coalesce(b.bkash_response->>'transactionStatus','') <> 'Completed'
       AND (b.payment_id IS NOT NULL OR b.created_at <= now()-interval '5 minutes')
     )
     AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'subject_ids') old_id
       JOIN jsonb_array_elements_text(item->'subject_ids') new_id ON old_id.value=new_id.value))
 THEN RAISE EXCEPTION 'An unfinished payment already includes these subjects. Finish or reconcile that payment first.'; END IF;
 IF (context->>'amount')::numeric<=0 OR (context->>'discount')::numeric<0
   OR (context->>'amount')::numeric+(context->>'discount')::numeric<>(fresh->>'price')::numeric THEN RAISE EXCEPTION 'Invalid payable amount'; END IF;
 INSERT INTO public.bkash_payments(user_id,merchant_invoice_number,amount,discount,coupon_code,selected_packages,payer_reference,institute_name,teacher_name,teacher_email,status,environment)
 VALUES(buyer,context->>'merchant_invoice_number',(context->>'amount')::numeric,(context->>'discount')::numeric,context->>'coupon_code',
   jsonb_build_array(fresh),context->>'payer_reference',context->>'institute_name',context->>'teacher_name',context->>'teacher_email','initiated',context->>'environment') RETURNING bkash_payments.id INTO id;
 RETURN id;
END $function$
;
