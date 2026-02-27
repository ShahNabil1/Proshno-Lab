
-- Create question_reports table
CREATE TABLE public.question_reports (
  id bigint generated always as identity primary key,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  error_type text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_reply text DEFAULT NULL,
  resolved_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own reports
CREATE POLICY "Teachers can read own reports"
ON public.question_reports FOR SELECT
USING (auth.uid() = teacher_id);

-- Teachers can insert their own reports
CREATE POLICY "Teachers can insert own reports"
ON public.question_reports FOR INSERT
WITH CHECK (auth.uid() = teacher_id);

-- Admins can manage all reports
CREATE POLICY "Admins can manage all reports"
ON public.question_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
