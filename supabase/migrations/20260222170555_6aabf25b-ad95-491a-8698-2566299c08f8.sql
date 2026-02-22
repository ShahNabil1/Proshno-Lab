
-- Drop existing tables that will be rebuilt
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.institutes CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.mongo_raw CASCADE;

-- 1. Teachers (profiles) table
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own profile" ON public.teachers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teachers can update own profile" ON public.teachers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Teachers can insert own profile" ON public.teachers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can manage all teachers" ON public.teachers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create teacher profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.teachers (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.email, ''));
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Institutes
CREATE TABLE public.institutes (
  id bigserial PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  upazila text DEFAULT '',
  district text DEFAULT '',
  division text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own institute" ON public.institutes FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Teachers can insert own institute" ON public.institutes FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Teachers can update own institute" ON public.institutes FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all institutes" ON public.institutes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. Classes
CREATE TABLE public.classes (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4. Subjects
CREATE TABLE public.subjects (
  id bigserial PRIMARY KEY,
  class_id bigint NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. Chapters
CREATE TABLE public.chapters (
  id bigserial PRIMARY KEY,
  subject_id bigint NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read chapters" ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage chapters" ON public.chapters FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 6. Question Categories
CREATE TABLE public.question_categories (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read categories" ON public.question_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.question_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 7. Questions
CREATE TABLE public.questions (
  id bigserial PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id bigint NOT NULL REFERENCES public.classes(id),
  subject_id bigint NOT NULL REFERENCES public.subjects(id),
  chapter_id bigint NOT NULL REFERENCES public.chapters(id),
  category_id bigint REFERENCES public.question_categories(id),
  type text NOT NULL DEFAULT 'mcq',
  question text NOT NULL,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own questions" ON public.questions FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own questions" ON public.questions FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own questions" ON public.questions FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own questions" ON public.questions FOR DELETE USING (auth.uid() = teacher_id);
CREATE POLICY "Admins can manage all questions" ON public.questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 8. Subscriptions (rebuilt)
CREATE TABLE public.subscriptions (
  id bigserial PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'inactive',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 9. Feedback (rebuilt)
CREATE TABLE public.feedback (
  id bigserial PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'low',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own feedback" ON public.feedback FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Admins can read all feedback" ON public.feedback FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_subjects_class ON public.subjects(class_id);
CREATE INDEX idx_chapters_subject ON public.chapters(subject_id);
CREATE INDEX idx_questions_teacher ON public.questions(teacher_id);
CREATE INDEX idx_questions_class ON public.questions(class_id);
CREATE INDEX idx_questions_subject ON public.questions(subject_id);
CREATE INDEX idx_questions_chapter ON public.questions(chapter_id);
CREATE INDEX idx_institutes_owner ON public.institutes(owner_id);
CREATE INDEX idx_subscriptions_teacher ON public.subscriptions(teacher_id);
