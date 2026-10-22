BEGIN;
CREATE OR REPLACE FUNCTION public.claim_payment_telegram_events() RETURNS SETOF public.payment_telegram_events
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO public.payment_telegram_events(payment_id,event_type)
 SELECT b.id,'payment_incomplete' FROM public.bkash_payments b
 WHERE b.status='initiated' AND b.payment_id IS NOT NULL
 AND b.created_at>=(SELECT started_at FROM public.payment_telegram_settings WHERE singleton)
 AND b.created_at<=now()-interval '2 minutes'
 AND NOT EXISTS(SELECT 1 FROM public.bkash_payments newer WHERE newer.user_id=b.user_id AND newer.id>b.id)
 ON CONFLICT(payment_id,event_type) DO NOTHING;
 RETURN QUERY WITH candidates AS (
  SELECT e.id FROM public.payment_telegram_events e
  WHERE (e.status='pending' AND e.available_at<=now()) OR (e.status='sending' AND e.locked_until<now())
  ORDER BY CASE WHEN e.event_type='payment_success' THEN 0 ELSE 1 END,e.id FOR UPDATE SKIP LOCKED LIMIT 5
 ) UPDATE public.payment_telegram_events e SET status='sending',attempts=e.attempts+1,
 lease_token=gen_random_uuid(),locked_until=now()+interval '5 minutes'
 FROM candidates c WHERE e.id=c.id RETURNING e.*;
END $$;
CREATE OR REPLACE FUNCTION public.queue_payment_telegram_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text;
BEGIN
 IF NEW.status='completed' AND NEW.trx_id IS NOT NULL THEN kind:='payment_success';
 ELSIF NEW.status='failed' AND NEW.payment_id IS NOT NULL THEN kind:='payment_failed';
 ELSIF NEW.status='cancelled' AND NEW.payment_id IS NOT NULL THEN kind:='payment_cancelled';
 ELSE RETURN NEW; END IF;
 INSERT INTO public.payment_telegram_events(payment_id,event_type) VALUES(NEW.id,kind) ON CONFLICT(payment_id,event_type) DO NOTHING;
 IF FOUND THEN
  BEGIN
   PERFORM public.dispatch_payment_telegram_events();
  EXCEPTION WHEN OTHERS THEN
   RAISE WARNING 'Immediate notification dispatch failed; scheduler will retry';
  END;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.dispatch_payment_telegram_events() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,net AS $$
DECLARE secret text; base_url text;
BEGIN
 -- Avoid calling the worker on idle polls; keep retries and lease recovery durable.
 IF NOT EXISTS(SELECT 1 FROM public.payment_telegram_events e
  WHERE (e.status='pending' AND e.available_at<=now()) OR (e.status='sending' AND e.locked_until<now()))
 AND NOT EXISTS(SELECT 1 FROM public.bkash_payments b
  WHERE b.status='initiated' AND b.payment_id IS NOT NULL
  AND b.created_at>=(SELECT started_at FROM public.payment_telegram_settings WHERE singleton)
  AND b.created_at<=now()-interval '2 minutes'
  AND NOT EXISTS(SELECT 1 FROM public.bkash_payments newer WHERE newer.user_id=b.user_id AND newer.id>b.id)
  AND NOT EXISTS(SELECT 1 FROM public.payment_telegram_events e WHERE e.payment_id=b.id AND e.event_type='payment_incomplete'))
 THEN RETURN; END IF;
 SELECT project_url INTO base_url FROM public.meta_capi_settings WHERE singleton;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='meta_capi_worker_token';
 IF base_url IS NULL OR secret IS NULL THEN RAISE EXCEPTION 'Notification scheduler unavailable'; END IF;
 PERFORM net.http_post(url:=base_url||'/functions/v1/payment-telegram-worker',body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','x-capi-worker-token',secret),timeout_milliseconds:=60000);
END $$;
SELECT cron.schedule('payment-telegram-delivery','10 seconds','SELECT public.dispatch_payment_telegram_events()');
COMMIT;
