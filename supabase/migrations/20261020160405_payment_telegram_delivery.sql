BEGIN;
CREATE TABLE public.payment_telegram_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_telegram_settings(singleton) VALUES(true);
CREATE TABLE public.payment_telegram_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 payment_id bigint NOT NULL REFERENCES public.bkash_payments(id),
 event_type text NOT NULL CHECK(event_type IN ('payment_success','payment_incomplete','payment_failed','payment_cancelled')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','skipped','failed')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, locked_until timestamptz,
 delivered_chat_ids text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 UNIQUE(payment_id,event_type)
);
ALTER TABLE public.payment_telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_telegram_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_telegram_settings,public.payment_telegram_events FROM anon,authenticated;
GRANT ALL ON public.payment_telegram_settings,public.payment_telegram_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.payment_telegram_events_id_seq TO service_role;
CREATE INDEX payment_telegram_pending ON public.payment_telegram_events(available_at,id) WHERE status='pending';
CREATE INDEX payment_telegram_locked ON public.payment_telegram_events(locked_until) WHERE status='sending';

CREATE FUNCTION public.queue_payment_telegram_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text;
BEGIN
 IF NEW.status='completed' AND NEW.trx_id IS NOT NULL THEN kind:='payment_success';
 ELSIF NEW.status='failed' AND NEW.payment_id IS NOT NULL THEN kind:='payment_failed';
 ELSIF NEW.status='cancelled' AND NEW.payment_id IS NOT NULL THEN kind:='payment_cancelled';
 ELSE RETURN NEW; END IF;
 INSERT INTO public.payment_telegram_events(payment_id,event_type) VALUES(NEW.id,kind) ON CONFLICT(payment_id,event_type) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_payment_telegram_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_payment_telegram AFTER INSERT OR UPDATE OF status,trx_id ON public.bkash_payments
FOR EACH ROW EXECUTE FUNCTION public.queue_payment_telegram_event();

-- These branches previously returned before the only Telegram send call.
-- Recover recent missed receipts without re-sending the old fixed-package path.
INSERT INTO public.payment_telegram_events(payment_id,event_type)
SELECT id,'payment_success' FROM public.bkash_payments
WHERE status='completed' AND trx_id IS NOT NULL AND created_at>=now()-interval '24 hours'
AND selected_packages->0->>'kind' IN ('custom','payg')
AND bkash_response->>'transactionStatus'='Completed'
ON CONFLICT(payment_id,event_type) DO NOTHING;

CREATE FUNCTION public.claim_payment_telegram_events() RETURNS SETOF public.payment_telegram_events
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO public.payment_telegram_events(payment_id,event_type)
 SELECT b.id,'payment_incomplete' FROM public.bkash_payments b
 WHERE b.status='initiated' AND b.payment_id IS NOT NULL
 AND b.created_at>=(SELECT started_at FROM public.payment_telegram_settings WHERE singleton)
 AND b.created_at<=now()-interval '15 minutes'
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
CREATE FUNCTION public.record_payment_telegram_chat(event_ref bigint,lease uuid,chat text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.payment_telegram_events SET delivered_chat_ids=array_append(delivered_chat_ids,chat)
 WHERE id=event_ref AND status='sending' AND lease_token=lease AND NOT chat=ANY(delivered_chat_ids);
 IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.payment_telegram_events WHERE id=event_ref AND status='sending' AND lease_token=lease AND chat=ANY(delivered_chat_ids)) THEN RAISE EXCEPTION 'Delivery lease lost'; END IF;
END $$;
CREATE FUNCTION public.finish_payment_telegram_event(event_ref bigint,lease uuid,outcome text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF outcome NOT IN ('sent','skipped','retry') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 UPDATE public.payment_telegram_events SET
 status=CASE WHEN outcome='retry' THEN CASE WHEN attempts>=8 THEN 'failed' ELSE 'pending' END ELSE outcome END,
 available_at=CASE WHEN outcome='retry' THEN now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer) ELSE available_at END,
 sent_at=CASE WHEN outcome='sent' THEN now() ELSE sent_at END,lease_token=NULL,locked_until=NULL
 WHERE id=event_ref AND status='sending' AND lease_token=lease;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery lease lost'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_payment_telegram_events(),public.record_payment_telegram_chat(bigint,uuid,text),public.finish_payment_telegram_event(bigint,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_telegram_events(),public.record_payment_telegram_chat(bigint,uuid,text),public.finish_payment_telegram_event(bigint,uuid,text) TO service_role;

CREATE FUNCTION public.dispatch_payment_telegram_events() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,net AS $$
DECLARE secret text; base_url text;
BEGIN
 SELECT project_url INTO base_url FROM public.meta_capi_settings WHERE singleton;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='meta_capi_worker_token';
 IF base_url IS NULL OR secret IS NULL THEN RAISE EXCEPTION 'Notification scheduler unavailable'; END IF;
 PERFORM net.http_post(url:=base_url||'/functions/v1/payment-telegram-worker',body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','x-capi-worker-token',secret),timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_payment_telegram_events() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_payment_telegram_events() TO service_role;
SELECT cron.schedule('payment-telegram-delivery','* * * * *','SELECT public.dispatch_payment_telegram_events()');
COMMIT;
