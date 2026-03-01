
-- App settings key-value store
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only developers can update
CREATE POLICY "Developers can manage app_settings"
  ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'developer'));

-- Insert default: cloud backup disabled
INSERT INTO public.app_settings (key, value) VALUES ('cloud_backup_enabled', 'false'::jsonb);
