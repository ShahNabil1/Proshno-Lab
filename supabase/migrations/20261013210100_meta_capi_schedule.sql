BEGIN;
-- The scheduler's credential is generated/stored inside Vault, never in source.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='meta_capi_worker_token') THEN
   PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'meta_capi_worker_token');
 END IF;
END $$;
CREATE FUNCTION public.authorize_meta_capi_worker(token text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,vault,extensions AS $$
 SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='meta_capi_worker_token'
   AND extensions.digest(token,'sha256')=extensions.digest(decrypted_secret,'sha256'));
$$;
REVOKE ALL ON FUNCTION public.authorize_meta_capi_worker(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_meta_capi_worker(text) TO service_role;

CREATE FUNCTION public.dispatch_meta_capi_events() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,net AS $$
DECLARE secret text; base_url text;
BEGIN
 SELECT project_url INTO base_url FROM public.meta_capi_settings WHERE singleton AND enabled AND NOT delivery_paused;
 IF base_url IS NULL OR NOT EXISTS(SELECT 1 FROM public.meta_capi_events WHERE status='pending' AND available_at<=now() OR status='sending' AND locked_until<now()) THEN RETURN; END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='meta_capi_worker_token';
 PERFORM net.http_post(url:=base_url||'/functions/v1/meta-capi-worker',body:='{}'::jsonb,
   headers:=jsonb_build_object('Content-Type','application/json','x-capi-worker-token',secret),timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_meta_capi_events() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_meta_capi_events() TO service_role;
SELECT cron.schedule('meta-capi-delivery','* * * * *','SELECT public.dispatch_meta_capi_events()');
SELECT cron.schedule('meta-capi-retention','20 3 * * *',
 $$DELETE FROM public.meta_capi_events WHERE (status='sent' AND created_at<now()-interval '30 days') OR (status IN ('failed','expired') AND created_at<now()-interval '7 days'); DELETE FROM public.meta_capi_rate_limits WHERE window_start<now()-interval '1 day';$$);
COMMIT;
