GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutes TO authenticated;
GRANT ALL ON public.institutes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.institutes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.institutes_id_seq TO service_role;