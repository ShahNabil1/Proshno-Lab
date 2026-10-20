BEGIN;
CREATE TABLE public.admin_sms_gateway (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 provider text NOT NULL DEFAULT 'bulksmsbd' CHECK (provider='bulksmsbd'),
 sender_id text NOT NULL DEFAULT '', api_key text NOT NULL DEFAULT '',
 enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_sms_campaigns (
 id uuid PRIMARY KEY, created_by uuid NOT NULL REFERENCES auth.users(id),
 message text NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
 phones text[] NOT NULL CHECK (cardinality(phones) BETWEEN 1 AND 50),
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','submitted','rejected','unknown')),
 provider_code text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_sms_gateway ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sms_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sms_gateway,public.admin_sms_campaigns FROM anon,authenticated;
GRANT ALL ON public.admin_sms_gateway,public.admin_sms_campaigns TO service_role;
COMMIT;
