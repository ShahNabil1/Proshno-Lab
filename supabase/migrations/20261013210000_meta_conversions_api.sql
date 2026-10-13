BEGIN;
CREATE TABLE public.meta_capi_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  customer_matching boolean NOT NULL DEFAULT false,
  delivery_paused boolean NOT NULL DEFAULT false,
  pixel_id text NOT NULL DEFAULT '39691774247102448' CHECK(pixel_id ~ '^\d+$'),
  project_url text NOT NULL DEFAULT 'https://biekabnpseyardqgutbp.supabase.co',
  installed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.meta_capi_settings(singleton) VALUES(true);
CREATE TABLE public.meta_capi_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pixel_id text NOT NULL,
  event_name text NOT NULL,
  event_id text NOT NULL,
  event_time bigint NOT NULL,
  source_url text NOT NULL,
  user_data jsonb NOT NULL DEFAULT '{}',
  custom_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','expired')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lease uuid,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pixel_id,event_name,event_id)
);
CREATE INDEX meta_capi_pending ON public.meta_capi_events(available_at) WHERE status IN ('pending','sending');
CREATE TABLE public.meta_capi_rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL DEFAULT now(), hits integer NOT NULL DEFAULT 1);
ALTER TABLE public.bkash_payments ADD COLUMN marketing_context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.meta_capi_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_capi_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_capi_settings,public.meta_capi_events,public.meta_capi_rate_limits FROM anon,authenticated;
GRANT ALL ON public.meta_capi_settings,public.meta_capi_events,public.meta_capi_rate_limits TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.meta_capi_events_id_seq TO service_role;

CREATE FUNCTION public.meta_capi_hash(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,extensions AS $$
 SELECT encode(extensions.digest(convert_to(lower(btrim(value)),'UTF8'),'sha256'),'hex');
$$;
REVOKE ALL ON FUNCTION public.meta_capi_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_capi_hash(text) TO service_role;

-- Conversion authority belongs to verified database records, never browser POSTs.
CREATE FUNCTION public.queue_meta_capi_purchase() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE config public.meta_capi_settings; matching jsonb; phone text; receipt_amount numeric;
BEGIN
 SELECT * INTO config FROM public.meta_capi_settings WHERE singleton;
 IF NOT config.enabled OR NEW.status<>'completed' OR (TG_OP='UPDATE' AND OLD.status='completed') OR NEW.environment IS DISTINCT FROM 'live' OR NEW.trx_id IS NULL THEN RETURN NEW; END IF;
 receipt_amount:=CASE WHEN NEW.bkash_response->>'amount' ~ '^\d+(\.\d+)?$' THEN (NEW.bkash_response->>'amount')::numeric END;
 IF NEW.bkash_response->>'transactionStatus' IS DISTINCT FROM 'Completed'
   OR NEW.bkash_response->>'currency' IS DISTINCT FROM 'BDT'
   OR NEW.bkash_response->>'trxID' IS DISTINCT FROM NEW.trx_id
   OR NEW.bkash_response->>'paymentID' IS DISTINCT FROM NEW.payment_id
   OR receipt_amount IS DISTINCT FROM NEW.amount OR NOT (NEW.amount>0) THEN RETURN NEW; END IF;
 matching:=jsonb_strip_nulls(jsonb_build_object(
   'fbp',NEW.marketing_context->>'fbp','fbc',NEW.marketing_context->>'fbc',
   'client_user_agent',NEW.marketing_context->>'user_agent','client_ip_address',NEW.marketing_context->>'client_ip_address'));
 IF config.customer_matching THEN
   IF NEW.teacher_email IS NOT NULL THEN matching:=matching||jsonb_build_object('em',jsonb_build_array(public.meta_capi_hash(NEW.teacher_email))); END IF;
   phone:=regexp_replace(coalesce(NEW.payer_reference,''),'\D','','g');
   IF phone ~ '^01[3-9]\d{8}$' THEN phone:='88'||phone; END IF;
   IF phone ~ '^8801[3-9]\d{8}$' THEN matching:=matching||jsonb_build_object('ph',jsonb_build_array(public.meta_capi_hash(phone))); END IF;
   matching:=matching||jsonb_build_object('external_id',jsonb_build_array(public.meta_capi_hash(NEW.user_id::text)));
 END IF;
 INSERT INTO public.meta_capi_events(pixel_id,event_name,event_id,event_time,source_url,user_data,custom_data)
 VALUES(config.pixel_id,'Purchase','purchase:'||NEW.trx_id,extract(epoch FROM now())::bigint,
   coalesce(NEW.marketing_context->>'source_url','https://www.proshnolab.com/payment/callback'),matching,
   jsonb_build_object('value',NEW.amount,'currency','BDT')) ON CONFLICT(pixel_id,event_name,event_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER queue_meta_purchase AFTER INSERT OR UPDATE OF status ON public.bkash_payments FOR EACH ROW EXECUTE FUNCTION public.queue_meta_capi_purchase();

CREATE FUNCTION public.queue_meta_capi_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE config public.meta_capi_settings; matching jsonb:='{}';
BEGIN
 SELECT * INTO config FROM public.meta_capi_settings WHERE singleton;
 IF NOT config.enabled OR NEW.created_at<config.installed_at OR NEW.email_confirmed_at IS NULL
   OR (TG_OP='UPDATE' AND OLD.email_confirmed_at IS NOT NULL) THEN RETURN NEW; END IF;
 IF config.customer_matching THEN matching:=jsonb_build_object('em',jsonb_build_array(public.meta_capi_hash(NEW.email)),
   'external_id',jsonb_build_array(public.meta_capi_hash(NEW.id::text))); END IF;
 INSERT INTO public.meta_capi_events(pixel_id,event_name,event_id,event_time,source_url,user_data,custom_data)
 VALUES(config.pixel_id,'CompleteRegistration','registration:'||NEW.id,extract(epoch FROM now())::bigint,
   'https://www.proshnolab.com/register',matching,jsonb_build_object('status',true)) ON CONFLICT(pixel_id,event_name,event_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER queue_meta_registration AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.queue_meta_capi_registration();

CREATE FUNCTION public.enqueue_meta_capi_event(event jsonb,rate_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE config public.meta_capi_settings; count_hits integer;
BEGIN
 SELECT * INTO config FROM public.meta_capi_settings WHERE singleton;
 IF NOT config.enabled THEN RETURN false; END IF;
 IF event->>'event_name' NOT IN ('PageView','ViewContent','AddToCart','InitiateCheckout','AddPaymentInfo','Contact','Search','Login','PaperGenerated','QuestionCreated','PaperDownloaded','PrintRequested','PaymentFailed','PaymentCancelled')
   OR length(event->>'event_id') NOT BETWEEN 16 AND 100 THEN RAISE EXCEPTION 'Invalid marketing event'; END IF;
 IF event->>'source_url' !~ '^https://(www\.)?proshnolab\.com(/|$)' THEN RAISE EXCEPTION 'Invalid source'; END IF;
 INSERT INTO public.meta_capi_rate_limits(key) VALUES(rate_key) ON CONFLICT(key) DO UPDATE SET
   hits=CASE WHEN meta_capi_rate_limits.window_start<now()-interval '1 hour' THEN 1 ELSE meta_capi_rate_limits.hits+1 END,
   window_start=CASE WHEN meta_capi_rate_limits.window_start<now()-interval '1 hour' THEN now() ELSE meta_capi_rate_limits.window_start END RETURNING hits INTO count_hits;
 IF count_hits>120 THEN RETURN false; END IF;
 INSERT INTO public.meta_capi_events(pixel_id,event_name,event_id,event_time,source_url,user_data,custom_data)
 VALUES(config.pixel_id,event->>'event_name',event->>'event_id',extract(epoch FROM now())::bigint,event->>'source_url',
   coalesce(event->'user_data','{}'),coalesce(event->'custom_data','{}')) ON CONFLICT(pixel_id,event_name,event_id) DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_meta_capi_event(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_meta_capi_event(jsonb,text) TO service_role;

CREATE FUNCTION public.enrich_meta_capi_registration(user_ref uuid,context jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.meta_capi_events SET user_data=user_data||jsonb_strip_nulls(jsonb_build_object('fbp',context->>'fbp','fbc',context->>'fbc',
   'client_user_agent',context->>'user_agent','client_ip_address',context->>'client_ip_address'))
 WHERE event_name='CompleteRegistration' AND event_id='registration:'||user_ref AND status='pending';
$$;
REVOKE ALL ON FUNCTION public.enrich_meta_capi_registration(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_meta_capi_registration(uuid,jsonb) TO service_role;

CREATE FUNCTION public.claim_meta_capi_events(batch_size integer DEFAULT 25) RETURNS SETOF public.meta_capi_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.meta_capi_events SET status='expired',last_error='dedup_window_expired' WHERE status IN ('pending','sending') AND event_time<extract(epoch FROM now()-interval '47 hours');
 RETURN QUERY WITH candidates AS (
   SELECT id FROM public.meta_capi_events WHERE (status='pending' AND available_at<=now()) OR (status='sending' AND locked_until<now())
   ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(batch_size,25))
 ) UPDATE public.meta_capi_events e SET status='sending',attempts=attempts+1,locked_until=now()+interval '3 minutes',lease=gen_random_uuid()
 FROM candidates WHERE e.id=candidates.id RETURNING e.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_meta_capi_events(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_capi_events(integer) TO service_role;

CREATE FUNCTION public.finish_meta_capi_event(event_ref bigint,lease_ref uuid,delivered boolean,error_code text DEFAULT NULL,retryable boolean DEFAULT true) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.meta_capi_events SET status=CASE WHEN delivered THEN 'sent' WHEN NOT retryable OR attempts>=24 THEN 'failed' ELSE 'pending' END,
   sent_at=CASE WHEN delivered THEN now() ELSE sent_at END,
   user_data=CASE WHEN delivered THEN '{}'::jsonb ELSE user_data END,
   last_error=CASE WHEN delivered THEN NULL ELSE left(error_code,100) END,
   available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,12))::integer*30)),locked_until=NULL,lease=NULL
 WHERE id=event_ref AND lease=lease_ref AND status='sending';
$$;
REVOKE ALL ON FUNCTION public.finish_meta_capi_event(bigint,uuid,boolean,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_meta_capi_event(bigint,uuid,boolean,text,boolean) TO service_role;

CREATE FUNCTION public.meta_capi_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('enabled',s.enabled,'paused',s.delivery_paused,'pixel_id',s.pixel_id,
   'pending',(SELECT count(*) FROM meta_capi_events WHERE status IN ('pending','sending')),
   'sent',(SELECT count(*) FROM meta_capi_events WHERE status='sent'),
   'failed',(SELECT count(*) FROM meta_capi_events WHERE status IN ('failed','expired')),
   'last_sent_at',(SELECT max(sent_at) FROM meta_capi_events),
   'last_error',(SELECT last_error FROM meta_capi_events WHERE last_error IS NOT NULL ORDER BY created_at DESC LIMIT 1))
 INTO result FROM meta_capi_settings s WHERE singleton;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.meta_capi_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.meta_capi_status() TO authenticated;
COMMIT;
