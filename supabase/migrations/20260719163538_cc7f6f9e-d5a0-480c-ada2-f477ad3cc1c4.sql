
-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'developer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'developer')
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- Teachers
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own profile" ON public.teachers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teachers can update own profile" ON public.teachers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Teachers can insert own profile" ON public.teachers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can manage all teachers" ON public.teachers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.teachers (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.email, ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Institutes
CREATE TABLE public.institutes (
  id bigserial PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  upazila text DEFAULT '',
  district text DEFAULT '',
  division text DEFAULT '',
  phone text DEFAULT '',
  specific_address text DEFAULT '',
  last_edited_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own institute" ON public.institutes FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Teachers can insert own institute" ON public.institutes FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Teachers can update own institute" ON public.institutes FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all institutes" ON public.institutes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Classes / Subjects / Chapters / Topics / Categories
CREATE TABLE public.classes (id bigserial PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.subjects (
  id bigserial PRIMARY KEY,
  class_id bigint NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject_code text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.chapters (
  id bigserial PRIMARY KEY,
  subject_id bigint NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_free boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read chapters" ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage chapters" ON public.chapters FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.topics (
  id bigserial PRIMARY KEY,
  chapter_id bigint NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage topics" ON public.topics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read topics" ON public.topics FOR SELECT USING (true);

CREATE TABLE public.question_categories (id bigserial PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read categories" ON public.question_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.question_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Questions
CREATE TABLE public.questions (
  id bigserial PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id bigint NOT NULL REFERENCES public.classes(id),
  subject_id bigint NOT NULL REFERENCES public.subjects(id),
  chapter_id bigint NOT NULL REFERENCES public.chapters(id),
  topic_id bigint REFERENCES public.topics(id) ON DELETE SET NULL,
  category_id bigint REFERENCES public.question_categories(id),
  type text NOT NULL DEFAULT 'mcq',
  question text NOT NULL,
  option_a text, option_b text, option_c text, option_d text,
  correct_answer text,
  explanation text,
  creative_data jsonb DEFAULT NULL,
  board_references jsonb DEFAULT '[]'::jsonb,
  university_references jsonb DEFAULT '[]'::jsonb,
  stimulus_group_id uuid DEFAULT NULL,
  stimulus_text text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own questions" ON public.questions FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own questions" ON public.questions FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own questions" ON public.questions FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own questions" ON public.questions FOR DELETE USING (auth.uid() = teacher_id);
CREATE POLICY "Admins can manage all questions" ON public.questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read free chapter questions" ON public.questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chapters WHERE chapters.id = questions.chapter_id AND chapters.is_free = true AND chapters.is_active = true)
);
CREATE INDEX idx_questions_stimulus_group ON public.questions (stimulus_group_id) WHERE stimulus_group_id IS NOT NULL;
CREATE INDEX idx_questions_teacher ON public.questions(teacher_id);
CREATE INDEX idx_questions_class ON public.questions(class_id);
CREATE INDEX idx_questions_subject ON public.questions(subject_id);
CREATE INDEX idx_questions_chapter ON public.questions(chapter_id);
CREATE INDEX idx_subjects_class ON public.subjects(class_id);
CREATE INDEX idx_chapters_subject ON public.chapters(subject_id);
CREATE INDEX idx_institutes_owner ON public.institutes(owner_id);

-- Subscriptions
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
CREATE INDEX idx_subscriptions_teacher ON public.subscriptions(teacher_id);

-- Feedback
CREATE TABLE public.feedback (
  id bigserial PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'pending',
  admin_reply text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own feedback" ON public.feedback FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Admins can read all feedback" ON public.feedback FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- User permissions (subject-wise access)
CREATE TABLE public.user_permissions (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id bigint NOT NULL,
  subject_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_id, subject_id)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user_permissions" ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own permissions" ON public.user_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.user_roles ADD COLUMN allowed_pages text[] DEFAULT NULL;

-- Admin delete user helper
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.feedback WHERE teacher_id = _user_id;
  DELETE FROM public.questions WHERE teacher_id = _user_id;
  DELETE FROM public.subscriptions WHERE teacher_id = _user_id;
  DELETE FROM public.institutes WHERE owner_id = _user_id;
  DELETE FROM public.teachers WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END; $$;

-- Purchase requests
CREATE TABLE public.purchase_requests (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  teacher_name text NOT NULL DEFAULT '',
  teacher_email text NOT NULL DEFAULT '',
  teacher_phone text NOT NULL DEFAULT '',
  institute_name text NOT NULL DEFAULT '',
  package_name text NOT NULL DEFAULT '',
  package_classes text NOT NULL DEFAULT '',
  package_price integer NOT NULL DEFAULT 0,
  coupon_code text DEFAULT '',
  discount integer NOT NULL DEFAULT 0,
  total_price integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT '',
  transaction_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_note text DEFAULT '',
  selected_packages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own purchase requests" ON public.purchase_requests FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert purchase requests" ON public.purchase_requests FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Anon can insert purchase requests" ON public.purchase_requests FOR INSERT TO anon WITH CHECK (teacher_id IS NULL);
CREATE POLICY "Admins can manage all purchase requests" ON public.purchase_requests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Coupons
CREATE TABLE public.coupons (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'fixed',
  discount_value integer NOT NULL DEFAULT 0,
  max_discount integer DEFAULT NULL,
  min_purchase integer NOT NULL DEFAULT 0,
  use_limit integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  applicable_packages text[] DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.coupons SET used_count = used_count + 1 WHERE code = coupon_code;
$$;

-- Pricing packages
CREATE TABLE public.pricing_packages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'class' CHECK (type IN ('bundle', 'class')),
  class_name TEXT NOT NULL,
  subject_name TEXT NOT NULL DEFAULT 'সকল বিষয়',
  price INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_coming_soon boolean NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active packages" ON public.pricing_packages FOR SELECT USING (true);
CREATE POLICY "Admins can manage packages" ON public.pricing_packages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.pricing_packages (type, class_name, subject_name, price, sort_order) VALUES
  ('bundle', 'ষষ্ঠ - দশম', 'সকল বিষয়', 900, 1),
  ('bundle', 'ষষ্ঠ - দ্বাদশ', 'সকল বিষয়', 1200, 2),
  ('class', 'ষষ্ঠ শ্রেণি', 'সকল বিষয়', 399, 10),
  ('class', 'ষষ্ঠ শ্রেণি', 'গণিত', 199, 11),
  ('class', 'ষষ্ঠ শ্রেণি', 'বিজ্ঞান', 199, 12),
  ('class', 'ষষ্ঠ শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 13),
  ('class', 'সপ্তম শ্রেণি', 'সকল বিষয়', 399, 20),
  ('class', 'সপ্তম শ্রেণি', 'গণিত', 199, 21),
  ('class', 'সপ্তম শ্রেণি', 'বিজ্ঞান', 199, 22),
  ('class', 'সপ্তম শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 23),
  ('class', 'অষ্টম শ্রেণি', 'সকল বিষয়', 399, 30),
  ('class', 'অষ্টম শ্রেণি', 'গণিত', 199, 31),
  ('class', 'অষ্টম শ্রেণি', 'বিজ্ঞান', 199, 32),
  ('class', 'অষ্টম শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 33),
  ('class', 'নবম-দশম শ্রেণি', 'সকল বিষয়', 399, 40),
  ('class', 'নবম-দশম শ্রেণি', 'গণিত', 199, 41),
  ('class', 'নবম-দশম শ্রেণি', 'বিজ্ঞান', 199, 42),
  ('class', 'নবম-দশম শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 43),
  ('class', 'একাদশ শ্রেণি', 'সকল বিষয়', 399, 50),
  ('class', 'একাদশ শ্রেণি', 'গণিত', 199, 51),
  ('class', 'একাদশ শ্রেণি', 'বিজ্ঞান', 199, 52),
  ('class', 'একাদশ শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 53),
  ('class', 'দ্বাদশ শ্রেণি', 'সকল বিষয়', 399, 60),
  ('class', 'দ্বাদশ শ্রেণি', 'গণিত', 199, 61),
  ('class', 'দ্বাদশ শ্রেণি', 'বিজ্ঞান', 199, 62),
  ('class', 'দ্বাদশ শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 63);

-- Saved papers
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own papers" ON public.saved_papers FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own papers" ON public.saved_papers FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own papers" ON public.saved_papers FOR DELETE USING (auth.uid() = teacher_id);
CREATE POLICY "Admins can manage all papers" ON public.saved_papers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_saved_papers_teacher ON public.saved_papers(teacher_id);
CREATE INDEX idx_saved_papers_class ON public.saved_papers(class_name);

-- Question reports
CREATE TABLE public.question_reports (
  id bigint generated always as identity primary key,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  error_type text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_reply text DEFAULT NULL,
  resolved_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own reports" ON public.question_reports FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own reports" ON public.question_reports FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Admins can manage all reports" ON public.question_reports FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Announcements
CREATE TABLE public.announcements (
  id bigint generated always as identity primary key,
  text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- FAQs
CREATE TABLE public.faqs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active faqs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Admins can manage faqs" ON public.faqs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.faqs (question, answer, sort_order) VALUES
  ('eExamapp এর সেবা সমূহ কি কি?', 'আমরা ১ ক্লিকে প্রশ্ন তৈরি, অধ্যায়ভিত্তিক eExamapp, অনলাইন পরীক্ষা এবং OMR মূল্যায়ন সেবা প্রদান করি।', 1),
  ('১ ক্লিকে প্রশ্ন তৈরীতে কি কি কাস্টমাইজ করা যাবে?', 'শ্রেণি, বিষয়, অধ্যায়, প্রশ্নের ধরন, নম্বর বণ্টন, সময় এবং প্রতিষ্ঠানের তথ্য কাস্টমাইজ করা যায়।', 2),
  ('কি কি উপায়ে প্রশ্ন বাছাই করা যাবে?', 'শ্রেণি, বিষয়, অধ্যায়, বোর্ড, সাল এবং প্রশ্নের ধরন অনুযায়ী ফিল্টার করে প্রশ্ন বাছাই করা যায়।', 3),
  ('OMR Evaluator Features কি কি?', 'স্বয়ংক্রিয় OMR শীট মূল্যায়ন, ফলাফল বিশ্লেষণ, মেরিট লিস্ট তৈরি এবং রিপোর্ট জেনারেশন।', 4),
  ('সাবস্ক্রিপশন এর মেয়াদ, লিমিট আছে কি?', 'প্যাকেজ ভেদে মেয়াদ ও লিমিট ভিন্ন। বিস্তারিত মূল্য তালিকা পাতায় দেখুন।', 5);

-- Reviews
CREATE TABLE public.reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  name text NOT NULL,
  designation text NOT NULL DEFAULT '',
  institution text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  rating smallint NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read approved reviews" ON public.reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Users can read own reviews" ON public.reviews FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Anyone can insert reviews" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage all reviews" ON public.reviews FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Suggestions
CREATE TABLE public.suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  class_id bigint NOT NULL REFERENCES public.classes(id),
  subject_id bigint NOT NULL REFERENCES public.subjects(id),
  question_ids bigint[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage suggestions" ON public.suggestions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read active suggestions" ON public.suggestions FOR SELECT USING (is_active = true);
CREATE TRIGGER update_suggestions_updated_at BEFORE UPDATE ON public.suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.suggestion_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  suggestion_id bigint NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  package_id bigint NOT NULL REFERENCES public.pricing_packages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, package_id)
);
ALTER TABLE public.suggestion_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage suggestion_assignments" ON public.suggestion_assignments FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read suggestion_assignments" ON public.suggestion_assignments FOR SELECT USING (true);

-- App settings
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Developers can manage app_settings" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'developer'));
INSERT INTO public.app_settings (key, value) VALUES ('cloud_backup_enabled', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('dashboard_hidden_pages', '[]'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('admin_hidden_pages', '[]'::jsonb) ON CONFLICT (key) DO NOTHING;

-- Analytics
CREATE TABLE public.analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id UUID,
  params JSONB DEFAULT '{}',
  page_url TEXT, page_path TEXT, user_agent TEXT, referrer TEXT, ip_address TEXT,
  client_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can insert analytics events" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read analytics events" ON public.analytics_events FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_events;

-- Triggers for updated_at
CREATE TRIGGER update_institutes_updated_at BEFORE UPDATE ON public.institutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subscription matcher helpers
CREATE OR REPLACE FUNCTION public.normalize_subscription_text(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(replace(replace(trim(coalesce(value, '')), 'শ্রেণি', ''), '–', '-'), '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.extract_class_levels(value text) RETURNS integer[] LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  normalized text := public.normalize_subscription_text(value);
  detected integer[] := ARRAY[]::integer[];
  expanded integer[];
BEGIN
  IF normalized LIKE '%ষষ্ঠ%' THEN detected := array_append(detected, 6); END IF;
  IF normalized LIKE '%সপ্তম%' THEN detected := array_append(detected, 7); END IF;
  IF normalized LIKE '%অষ্টম%' THEN detected := array_append(detected, 8); END IF;
  IF normalized LIKE '%নবম%' THEN detected := array_append(detected, 9); END IF;
  IF normalized LIKE '%দশম%' THEN detected := array_append(detected, 10); END IF;
  IF normalized LIKE '%একাদশ%' THEN detected := array_append(detected, 11); END IF;
  IF normalized LIKE '%দ্বাদশ%' THEN detected := array_append(detected, 12); END IF;
  detected := ARRAY(SELECT DISTINCT unnest(detected) ORDER BY 1);
  IF coalesce(array_length(detected, 1), 0) = 2
     AND position('-' in normalized) > 0
     AND position('/' in normalized) = 0
     AND abs(detected[1] - detected[2]) > 1 THEN
    expanded := ARRAY(SELECT generate_series(LEAST(detected[1], detected[2]), GREATEST(detected[1], detected[2])));
    RETURN expanded;
  END IF;
  RETURN detected;
END; $$;

CREATE OR REPLACE FUNCTION public.plan_covers_selection(plan text, class_name text, subject_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  normalized_plan text := public.normalize_subscription_text(plan);
  normalized_class text := public.normalize_subscription_text(class_name);
  normalized_subject text := public.normalize_subscription_text(subject_name);
  selected_levels integer[] := public.extract_class_levels(class_name);
  plan_levels integer[] := public.extract_class_levels(plan);
BEGIN
  IF normalized_plan = '' OR normalized_class = '' OR normalized_subject = '' THEN RETURN false; END IF;
  IF position(normalized_subject in normalized_plan) = 0 AND position('সকল বিষয়' in normalized_plan) = 0 THEN RETURN false; END IF;
  IF coalesce(array_length(selected_levels, 1), 0) = 0 OR coalesce(array_length(plan_levels, 1), 0) = 0 THEN
    RETURN position(normalized_class in normalized_plan) > 0;
  END IF;
  RETURN selected_levels && plan_levels;
END; $$;

CREATE OR REPLACE FUNCTION public.can_read_question(_class_id bigint, _subject_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND up.class_id = _class_id AND up.subject_id = _subject_id)
    OR EXISTS (
      SELECT 1 FROM public.subscriptions sub
      JOIN public.classes cls ON cls.id = _class_id
      JOIN public.subjects subj ON subj.id = _subject_id
      WHERE sub.teacher_id = auth.uid() AND sub.status = 'active'
        AND public.plan_covers_selection(sub.plan, cls.name, subj.name)
    );
$$;

CREATE POLICY "Users can read accessible questions" ON public.questions FOR SELECT TO authenticated USING (public.can_read_question(class_id, subject_id));

-- Blanket grants for all public tables (Data API access)
DO $grants$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated, service_role', r.sequence_name);
  END LOOP;
END $grants$;
