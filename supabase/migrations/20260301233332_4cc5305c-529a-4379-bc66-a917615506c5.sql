INSERT INTO public.app_settings (key, value)
VALUES ('dashboard_hidden_pages', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;