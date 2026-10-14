-- Leads are authoritative confirmed signups, never browser-authored or backfilled.
ALTER TABLE public.meta_capi_settings ADD COLUMN lead_installed_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION public.queue_meta_capi_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE config public.meta_capi_settings; matching jsonb := '{}';
BEGIN
 SELECT * INTO config FROM public.meta_capi_settings WHERE singleton;
 IF NOT config.enabled OR NEW.created_at < config.lead_installed_at
   OR NEW.email_confirmed_at IS NULL
   OR (TG_OP='UPDATE' AND OLD.email_confirmed_at IS NOT NULL) THEN RETURN NEW; END IF;
 IF config.customer_matching THEN
   matching := jsonb_build_object('external_id',jsonb_build_array(public.meta_capi_hash(NEW.id::text)));
   IF nullif(btrim(NEW.email),'') IS NOT NULL THEN
     matching := matching || jsonb_build_object('em',jsonb_build_array(public.meta_capi_hash(NEW.email)));
   END IF;
 END IF;
 INSERT INTO public.meta_capi_events(pixel_id,event_name,event_id,event_time,source_url,user_data,custom_data,available_at)
 VALUES(config.pixel_id,'Lead','lead:'||NEW.id,extract(epoch FROM now())::bigint,
   'https://www.proshnolab.com/register',matching,
   jsonb_build_object('content_name','Confirmed account signup'),now()+interval '30 seconds')
 ON CONFLICT(pixel_id,event_name,event_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_meta_capi_lead() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_meta_signup_lead AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.queue_meta_capi_lead();

-- Reuse authenticated signup context; never overwrite cleared data on sent events.
CREATE OR REPLACE FUNCTION public.enrich_meta_capi_registration(user_ref uuid,context jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.meta_capi_events SET user_data=user_data||jsonb_strip_nulls(jsonb_build_object(
   'fbp',context->>'fbp','fbc',context->>'fbc','client_user_agent',context->>'user_agent',
   'client_ip_address',context->>'client_ip_address'))
 WHERE ((event_name='CompleteRegistration' AND event_id='registration:'||user_ref)
     OR (event_name='Lead' AND event_id='lead:'||user_ref)) AND status='pending';
$$;
