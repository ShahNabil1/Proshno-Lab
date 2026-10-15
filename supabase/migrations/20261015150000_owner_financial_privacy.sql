BEGIN;

-- Use the verified auth identity, never editable profile/user_metadata values.
CREATE OR REPLACE FUNCTION public.is_business_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND id = 'b39b767f-be7a-4087-8d92-b9eabf273070'::uuid
      AND lower(email) = 'jmajharul@gmail.com'
      AND email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_business_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_owner() TO authenticated, service_role;

-- Restrictive policies also constrain existing broad admin policies.
-- Customers retain access to their own receipts and subscriptions.
CREATE POLICY owner_payment_privacy ON public.bkash_payments
AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_business_owner() OR user_id = auth.uid());
CREATE POLICY owner_subscription_privacy ON public.subscriptions
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_business_owner() OR teacher_id = auth.uid())
WITH CHECK (public.is_business_owner());
CREATE POLICY owner_custom_purchase_privacy ON public.custom_package_purchases
AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_business_owner() OR user_id = auth.uid());
CREATE POLICY owner_analytics_privacy ON public.analytics_events
AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_business_owner());

-- Retain existing aggregation logic behind owner-only entry points.
ALTER FUNCTION public.admin_marketing_overview(integer) RENAME TO owner_marketing_overview_internal;
REVOKE ALL ON FUNCTION public.owner_marketing_overview_internal(integer) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.admin_marketing_overview(period_days integer DEFAULT 7) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_business_owner() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.owner_marketing_overview_internal(period_days);
END $$;
REVOKE ALL ON FUNCTION public.admin_marketing_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_overview(integer) TO authenticated;

ALTER FUNCTION public.meta_capi_status() RENAME TO owner_meta_capi_status_internal;
REVOKE ALL ON FUNCTION public.owner_meta_capi_status_internal() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.meta_capi_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_business_owner() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.owner_meta_capi_status_internal();
END $$;
REVOKE ALL ON FUNCTION public.meta_capi_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meta_capi_status() TO authenticated;

COMMIT;
