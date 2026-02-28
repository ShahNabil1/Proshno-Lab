
-- Suggestions table: stores ready-made question papers/suggestions
CREATE TABLE public.suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  class_id bigint NOT NULL REFERENCES public.classes(id),
  subject_id bigint NOT NULL REFERENCES public.subjects(id),
  question_ids bigint[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Assignment table: links suggestions to pricing packages
CREATE TABLE public.suggestion_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  suggestion_id bigint NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  package_id bigint NOT NULL REFERENCES public.pricing_packages(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, package_id)
);

-- RLS for suggestions
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suggestions"
ON public.suggestions FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read active suggestions"
ON public.suggestions FOR SELECT
USING (is_active = true);

-- RLS for suggestion_assignments
ALTER TABLE public.suggestion_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suggestion_assignments"
ON public.suggestion_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read suggestion_assignments"
ON public.suggestion_assignments FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_suggestions_updated_at
BEFORE UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
