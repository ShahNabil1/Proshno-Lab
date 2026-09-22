-- Manual (off-platform) package grants.
-- Records what the customer actually paid and makes manual grants
-- distinguishable from bKash subscriptions on the admin dashboard.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'bkash',
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Any subscription without a bKash payment behind it was granted manually.
UPDATE public.subscriptions SET source = 'manual' WHERE bkash_payment_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON public.subscriptions(source);

COMMENT ON COLUMN public.subscriptions.source IS 'bkash = paid online, manual = granted from the admin panel (WhatsApp / cash / other)';
COMMENT ON COLUMN public.subscriptions.amount IS 'Amount the customer actually paid, for manual grants (bKash amount lives in bkash_payments)';
