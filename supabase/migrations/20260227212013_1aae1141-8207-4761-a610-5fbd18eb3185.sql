
-- Create saved_papers table to store generated question papers
CREATE TABLE public.saved_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  institution_name TEXT NOT NULL DEFAULT '',
  exam_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  subject_name TEXT NOT NULL DEFAULT '',
  chapter_names TEXT[] NOT NULL DEFAULT '{}',
  question_ids BIGINT[] NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_papers ENABLE ROW LEVEL SECURITY;

-- Teachers can read own papers
CREATE POLICY "Teachers can read own papers"
ON public.saved_papers
FOR SELECT
USING (auth.uid() = teacher_id);

-- Teachers can insert own papers
CREATE POLICY "Teachers can insert own papers"
ON public.saved_papers
FOR INSERT
WITH CHECK (auth.uid() = teacher_id);

-- Teachers can delete own papers
CREATE POLICY "Teachers can delete own papers"
ON public.saved_papers
FOR DELETE
USING (auth.uid() = teacher_id);

-- Admins can manage all papers
CREATE POLICY "Admins can manage all papers"
ON public.saved_papers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_saved_papers_teacher ON public.saved_papers(teacher_id);
CREATE INDEX idx_saved_papers_class ON public.saved_papers(class_name);
