ALTER TABLE public.mongo_raw ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role only" ON public.mongo_raw FOR ALL USING (false);