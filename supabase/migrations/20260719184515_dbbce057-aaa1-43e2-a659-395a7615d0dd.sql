
CREATE TABLE public.bkash_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_id TEXT UNIQUE,
  merchant_invoice_number TEXT UNIQUE NOT NULL,
  trx_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  selected_packages JSONB NOT NULL DEFAULT '[]'::jsonb,
  payer_reference TEXT,
  payer_account TEXT,
  customer_msisdn TEXT,
  institute_name TEXT,
  teacher_name TEXT,
  teacher_email TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  bkash_response JSONB,
  error_message TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bkash_payments TO authenticated;
GRANT ALL ON public.bkash_payments TO service_role;

ALTER TABLE public.bkash_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON public.bkash_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_bkash_payments_updated_at
  BEFORE UPDATE ON public.bkash_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bkash_payments_user ON public.bkash_payments(user_id);
CREATE INDEX idx_bkash_payments_status ON public.bkash_payments(status);
CREATE INDEX idx_bkash_payments_created ON public.bkash_payments(created_at DESC);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS bkash_payment_id BIGINT REFERENCES public.bkash_payments(id) ON DELETE SET NULL;
