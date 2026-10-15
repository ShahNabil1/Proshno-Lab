BEGIN;
-- Reuse the existing private Vault scheduler credential; no public worker access.
CREATE FUNCTION public.dispatch_payment_access_reconciliation() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,net AS $$
DECLARE secret text; base_url text;
BEGIN
 SELECT project_url INTO base_url FROM public.meta_capi_settings WHERE singleton;
 IF base_url IS NULL THEN RETURN; END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='meta_capi_worker_token';
 IF secret IS NULL THEN RAISE EXCEPTION 'Scheduler credential missing'; END IF;
 PERFORM net.http_post(url:=base_url||'/functions/v1/payment-access-reconcile',body:='{}'::jsonb,
   headers:=jsonb_build_object('Content-Type','application/json','x-capi-worker-token',secret),timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_payment_access_reconciliation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_payment_access_reconciliation() TO service_role;
SELECT cron.schedule('payment-access-reconciliation','*/5 * * * *','SELECT public.dispatch_payment_access_reconciliation()');
COMMIT;
