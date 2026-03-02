
CREATE TABLE public.analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id UUID,
  params JSONB DEFAULT '{}',
  page_url TEXT,
  page_path TEXT,
  user_agent TEXT,
  referrer TEXT,
  ip_address TEXT,
  client_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);

-- RLS: only service role can insert (via edge function), admins can read
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert analytics events"
ON public.analytics_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read analytics events"
ON public.analytics_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
