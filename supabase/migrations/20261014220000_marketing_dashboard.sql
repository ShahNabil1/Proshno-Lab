CREATE FUNCTION public.admin_marketing_overview(period_days integer DEFAULT 7) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; start_at timestamptz; previous_at timestamptz; end_at timestamptz; days integer;
BEGIN
 IF NOT (coalesce(public.has_role(auth.uid(),'admin'),false) OR coalesce(public.has_role(auth.uid(),'developer'),false))
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 days := CASE WHEN period_days IN (1,7,30) THEN period_days ELSE 7 END;
 end_at := ((now() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka';
 start_at := end_at - make_interval(days=>days);
 previous_at := start_at - make_interval(days=>days);
 WITH sales AS MATERIALIZED (
   SELECT DISTINCT ON (trx_id) trx_id,amount,created_at,user_id
   FROM public.bkash_payments
   WHERE status='completed' AND environment='live' AND nullif(trx_id,'') IS NOT NULL
     AND coalesce(coupon_code,'') NOT ILIKE 'PLTEST%'
   ORDER BY trx_id,created_at
 ), events AS MATERIALIZED (
   SELECT event_name,user_id,created_at,page_path,referrer FROM public.analytics_events
   WHERE created_at>=start_at AND created_at<end_at
     AND page_url ~ '^https://(www\.)?proshnolab\.com(/|$)'
     AND coalesce(page_path,'') !~ '^/(admin(/|$)|auth/callback|reset-password)'
 ), daily AS (
   SELECT d::date AS day,
     (SELECT coalesce(sum(amount),0) FROM sales WHERE (created_at AT TIME ZONE 'Asia/Dhaka')::date=d::date) AS revenue,
     (SELECT count(*) FROM auth.users WHERE (email_confirmed_at AT TIME ZONE 'Asia/Dhaka')::date=d::date) AS signups
   FROM generate_series((start_at AT TIME ZONE 'Asia/Dhaka')::date,(end_at AT TIME ZONE 'Asia/Dhaka')::date-1,interval '1 day') d
 ), sources AS (
   SELECT CASE WHEN nullif(referrer,'') IS NULL THEN 'Direct / Unknown'
     WHEN referrer ~ '^https?://' THEN lower(substring(referrer FROM '^https?://([^/:?#]+)')) ELSE 'Unknown' END AS source,
     count(*) AS views FROM events WHERE event_name='page_view' GROUP BY 1 ORDER BY 2 DESC LIMIT 6
 ), pages AS (
   SELECT left(split_part(split_part(coalesce(page_path,'/'), '?',1),'#',1),120) AS path,count(*) AS views
   FROM events WHERE event_name='page_view' GROUP BY 1 ORDER BY 2 DESC LIMIT 5
 )
 SELECT jsonb_build_object(
   'from',start_at,'to',end_at,'generated_at',now(),'days',days,
   'revenue',(SELECT coalesce(sum(amount),0) FROM sales WHERE created_at>=start_at AND created_at<end_at),
   'previous_revenue',(SELECT coalesce(sum(amount),0) FROM sales WHERE created_at>=previous_at AND created_at<start_at),
   'purchases',(SELECT count(*) FROM sales WHERE created_at>=start_at AND created_at<end_at),
   'buyers',(SELECT count(DISTINCT user_id) FROM sales WHERE created_at>=start_at AND created_at<end_at),
   'signups',(SELECT count(*) FROM auth.users WHERE email_confirmed_at>=start_at AND email_confirmed_at<end_at),
   'previous_signups',(SELECT count(*) FROM auth.users WHERE email_confirmed_at>=previous_at AND email_confirmed_at<start_at),
   'page_views',(SELECT count(*) FROM events WHERE event_name='page_view'),
   'pricing_views',(SELECT count(*) FROM events WHERE event_name='page_view' AND page_path='/pricing'),
   'checkouts',(SELECT count(*) FROM events WHERE event_name='begin_checkout'),
   'contacts',(SELECT count(*) FROM events WHERE event_name='contact'),
   'active_users',(SELECT count(DISTINCT user_id) FROM events),
   'pending_payments',(SELECT count(*) FROM public.bkash_payments WHERE status='initiated' AND environment='live' AND created_at>=start_at AND created_at<end_at AND coalesce(coupon_code,'') NOT ILIKE 'PLTEST%'),
   'failed_payments',(SELECT count(*) FROM public.bkash_payments WHERE status IN ('failed','cancelled') AND environment='live' AND created_at>=start_at AND created_at<end_at AND coalesce(coupon_code,'') NOT ILIKE 'PLTEST%'),
   'leads_sent',(SELECT count(*) FROM public.meta_capi_events WHERE event_name='Lead' AND status='sent' AND created_at>=start_at AND created_at<end_at),
   'leads_pending',(SELECT count(*) FROM public.meta_capi_events WHERE event_name='Lead' AND status IN ('pending','sending') AND created_at>=start_at AND created_at<end_at),
   'leads_failed',(SELECT count(*) FROM public.meta_capi_events WHERE event_name='Lead' AND status IN ('failed','expired') AND created_at>=start_at AND created_at<end_at),
   'active_subscriptions',(SELECT count(*) FROM public.subscriptions WHERE status='active' AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())),
   'daily',coalesce((SELECT jsonb_agg(to_jsonb(daily) ORDER BY day) FROM daily),'[]'),
   'sources',coalesce((SELECT jsonb_agg(to_jsonb(sources)) FROM sources),'[]'),
   'pages',coalesce((SELECT jsonb_agg(to_jsonb(pages)) FROM pages),'[]')
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_marketing_overview(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_overview(integer) TO authenticated;
