
-- Create function to increment coupon usage count
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coupons SET used_count = used_count + 1 WHERE code = coupon_code;
$$;
