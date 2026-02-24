
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS board_references jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS university_references jsonb DEFAULT '[]'::jsonb;
