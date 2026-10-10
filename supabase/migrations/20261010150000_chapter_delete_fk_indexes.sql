-- Avoid full-table scans while checking chapter references and cascading topics.
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON public.topics (chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic_id);
