BEGIN;
-- Serialize activation per payment. No permanent user_permissions are issued.
ALTER TABLE public.bkash_payments ADD COLUMN IF NOT EXISTS access_checked_at timestamptz;
CREATE FUNCTION public.complete_fixed_payment(payment_ref bigint, receipt jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bkash_payments; item jsonb; sid bigint; label text; start_time timestamptz; days integer;
BEGIN
 SELECT * INTO b FROM public.bkash_payments WHERE id=payment_ref FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment missing'; END IF;
 IF receipt->>'transactionStatus' IS DISTINCT FROM 'Completed' OR nullif(receipt->>'trxID','') IS NULL
   OR (receipt->>'amount')::numeric IS DISTINCT FROM b.amount OR receipt->>'currency' IS DISTINCT FROM 'BDT'
   OR receipt->>'paymentID' IS DISTINCT FROM b.payment_id
   OR (b.trx_id IS NOT NULL AND b.trx_id IS DISTINCT FROM receipt->>'trxID') THEN
   RAISE EXCEPTION 'Payment verification mismatch';
 END IF;
 IF jsonb_typeof(b.selected_packages) IS DISTINCT FROM 'array' OR jsonb_array_length(b.selected_packages)=0 THEN RAISE EXCEPTION 'Empty order'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.selected_packages) p WHERE p->>'kind' IN ('custom','payg')) THEN RAISE EXCEPTION 'Not a fixed order'; END IF;
 start_time:=coalesce(b.created_at,now());
 FOR item IN SELECT value FROM jsonb_array_elements(b.selected_packages) LOOP
   IF nullif(item->>'class_name','') IS NULL OR nullif(item->>'subject_name','') IS NULL THEN RAISE EXCEPTION 'Invalid package snapshot'; END IF;
   label:=(item->>'class_name')||' - '||(item->>'subject_name');
   -- Explicit IDs are authoritative; never infer additional subjects from labels.
   IF jsonb_typeof(item->'subject_ids')='array' THEN
     IF jsonb_array_length(item->'subject_ids')=0 OR EXISTS(
       SELECT 1 FROM jsonb_array_elements_text(item->'subject_ids') x
       WHERE NOT EXISTS(SELECT 1 FROM public.subjects s WHERE s.id::text=x.value)
     ) THEN RAISE EXCEPTION 'Invalid package subjects'; END IF;
   ELSIF NOT EXISTS(SELECT 1 FROM public.subjects s JOIN public.classes c ON c.id=s.class_id
     WHERE public.plan_covers_selection(label,c.name,s.name)) THEN
     RAISE EXCEPTION 'Package does not resolve to any subject';
   END IF;
   SELECT id INTO sid FROM public.subscriptions WHERE bkash_payment_id=b.id AND teacher_id=b.user_id AND plan=label AND package_type='fixed' ORDER BY id LIMIT 1;
   -- Preserve existing expiry and administrative deactivation on every retry.
   IF sid IS NULL THEN
     days:=(item->>'duration_days')::integer;
     IF days IS NOT NULL AND days NOT BETWEEN 1 AND 36500 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
     INSERT INTO public.subscriptions(teacher_id,plan,package_type,status,starts_at,ends_at,bkash_payment_id)
       VALUES(b.user_id,label,'fixed','active',start_time,
         CASE WHEN days IS NULL THEN start_time+interval '1 year' ELSE start_time+make_interval(days=>days) END,b.id);
   END IF;
 END LOOP;
 UPDATE public.bkash_payments SET status='completed',trx_id=receipt->>'trxID',bkash_response=receipt,
   payer_account=coalesce(receipt->>'payerAccount',payer_account),customer_msisdn=coalesce(receipt->>'customerMsisdn',customer_msisdn),
   error_message=NULL,access_checked_at=now() WHERE id=b.id;
 IF b.status IS DISTINCT FROM 'completed' AND b.coupon_code IS NOT NULL THEN PERFORM public.increment_coupon_usage(b.coupon_code); END IF;
END $$;
REVOKE ALL ON FUNCTION public.complete_fixed_payment(bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_fixed_payment(bigint,jsonb) TO service_role;
CREATE INDEX IF NOT EXISTS subscriptions_payment_plan ON public.subscriptions(bkash_payment_id,plan);
COMMIT;
