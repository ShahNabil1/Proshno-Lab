BEGIN;
CREATE TABLE public.user_telegram_notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('new_registration','new_feedback')),
 record_id bigint NOT NULL,
 payload jsonb NOT NULL,
 lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
 locked_until timestamptz NOT NULL DEFAULT now()+interval '1 minute',
 attempts integer NOT NULL DEFAULT 1,
 delivered_chat_ids text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 UNIQUE(event_type,record_id)
);
CREATE UNIQUE INDEX user_telegram_one_registration ON public.user_telegram_notifications(actor)
 WHERE event_type='new_registration';
CREATE INDEX user_telegram_actor_time ON public.user_telegram_notifications(actor,created_at DESC);
ALTER TABLE public.user_telegram_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_telegram_notifications FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.user_telegram_notifications TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.user_telegram_notifications_id_seq TO service_role;

-- Only the authenticated Edge Function can supply actor. No browser has EXECUTE.
CREATE FUNCTION public.claim_user_telegram_notification(actor uuid,event text,record_ref bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE source jsonb; msg jsonb; person text; email text; item public.user_telegram_notifications;
BEGIN
 IF actor IS NULL OR event NOT IN ('new_registration','new_feedback') THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('user_telegram:'||actor::text,0));
 IF event='new_registration' THEN
  SELECT to_jsonb(i) INTO source FROM public.institutes i
  WHERE i.owner_id=actor AND (record_ref IS NULL OR i.id=record_ref)
   AND i.created_at>=now()-interval '24 hours'
  ORDER BY i.id DESC LIMIT 1;
 ELSE
  SELECT to_jsonb(f) INTO source FROM public.feedback f
  WHERE f.teacher_id=actor AND (record_ref IS NULL OR f.id=record_ref)
   AND f.created_at>=now()-interval '24 hours'
  ORDER BY f.id DESC LIMIT 1;
 END IF;
 IF source IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO item FROM public.user_telegram_notifications n
 WHERE n.actor=claim_user_telegram_notification.actor AND n.event_type=event
 AND (n.record_id=(source->>'id')::bigint OR event='new_registration') LIMIT 1;
 IF FOUND THEN
  IF item.sent_at IS NOT NULL OR item.locked_until>now() OR item.attempts>=5 THEN
   RETURN jsonb_build_object('duplicate',true);
  END IF;
  UPDATE public.user_telegram_notifications n SET lease_token=gen_random_uuid(),
   locked_until=now()+interval '1 minute',attempts=n.attempts+1
   WHERE n.id=item.id RETURNING * INTO item;
  RETURN to_jsonb(item);
 END IF;
 IF EXISTS(SELECT 1 FROM public.user_telegram_notifications n
  WHERE n.actor=claim_user_telegram_notification.actor AND n.created_at>now()-interval '5 minutes') THEN
  RETURN jsonb_build_object('rate_limited',true);
 END IF;
 SELECT t.email,coalesce(t.full_name,'—')
 INTO email,person FROM public.teachers t WHERE t.id=actor;
 IF event='new_registration' THEN
  msg=jsonb_build_object('event_type',event,'title','🎉 নতুন রেজিস্ট্রেশন — Proshno Lab','fields',jsonb_build_array(
   jsonb_build_object('label','👤 Teacher','value',person),
   jsonb_build_object('label','📧 Email','value',email),
   jsonb_build_object('label','🏫 Institute','value',source->>'name'),
   jsonb_build_object('label','📱 Phone','value',source->>'phone'),
   jsonb_build_object('label','📍 Location','value',concat_ws(' > ',source->>'division',source->>'district',source->>'upazila')),
   jsonb_build_object('label','🏠 Address','value',source->>'specific_address')));
 ELSE
  msg=jsonb_build_object('event_type',event,'title','💬 নতুন Feedback — Proshno Lab','fields',jsonb_build_array(
   jsonb_build_object('label','👤 Teacher','value',email),
   jsonb_build_object('label','📂 Category','value',source->>'category'),
   jsonb_build_object('label','⚡ Priority','value',source->>'priority'),
   jsonb_build_object('label','📝 Subject','value',source->>'subject'),
   jsonb_build_object('label','💭 Details','value',left(source->>'details',500))));
 END IF;
 INSERT INTO public.user_telegram_notifications(actor,event_type,record_id,payload)
 VALUES(actor,event,(source->>'id')::bigint,msg) RETURNING * INTO item;
 RETURN to_jsonb(item);
END $$;
REVOKE ALL ON FUNCTION public.claim_user_telegram_notification(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_user_telegram_notification(uuid,text,bigint) TO service_role;

CREATE FUNCTION public.record_user_telegram_delivery(notification_ref bigint,lease uuid,chat text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 UPDATE public.user_telegram_notifications n SET delivered_chat_ids=array_append(n.delivered_chat_ids,chat)
 WHERE n.id=notification_ref AND n.lease_token=lease AND n.sent_at IS NULL
 AND n.locked_until>now() AND NOT(chat=ANY(n.delivered_chat_ids));
 IF NOT FOUND THEN RAISE EXCEPTION 'Notification lease unavailable'; END IF;
END $$;
CREATE FUNCTION public.finish_user_telegram_notification(notification_ref bigint,lease uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 UPDATE public.user_telegram_notifications n SET sent_at=now()
 WHERE n.id=notification_ref AND n.lease_token=lease AND n.sent_at IS NULL AND n.locked_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Notification lease unavailable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_user_telegram_delivery(bigint,uuid,text),public.finish_user_telegram_notification(bigint,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_telegram_delivery(bigint,uuid,text),public.finish_user_telegram_notification(bigint,uuid)
 TO service_role;

-- Replace the public anon-key cron invocation with the existing private Vault credential.
CREATE FUNCTION public.dispatch_daily_telegram_summary() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault,net AS $$
DECLARE secret text; base_url text;
BEGIN
 SELECT project_url INTO base_url FROM public.meta_capi_settings WHERE singleton;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='meta_capi_worker_token';
 IF base_url IS NULL OR secret IS NULL THEN RAISE EXCEPTION 'Notification scheduler unavailable'; END IF;
 PERFORM net.http_post(url:=base_url||'/functions/v1/daily-summary',body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','x-capi-worker-token',secret),timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_daily_telegram_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_telegram_summary() TO service_role;
SELECT cron.schedule('proshnolab-daily-summary','0 17 * * *','SELECT public.dispatch_daily_telegram_summary();');
COMMIT;
