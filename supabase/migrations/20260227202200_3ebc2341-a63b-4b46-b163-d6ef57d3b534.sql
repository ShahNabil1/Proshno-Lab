
-- Add stimulus grouping support to questions table
-- stimulus_group_id: UUID to group multiple MCQs under one stimulus
-- stimulus_text: The shared stimulus/উদ্দীপক text (stored on all questions in the group for easy access)

ALTER TABLE public.questions
ADD COLUMN stimulus_group_id uuid DEFAULT NULL,
ADD COLUMN stimulus_text text DEFAULT NULL;

-- Index for fast group lookups
CREATE INDEX idx_questions_stimulus_group ON public.questions (stimulus_group_id) WHERE stimulus_group_id IS NOT NULL;
