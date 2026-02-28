
-- Create reviews table
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
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews
CREATE POLICY "Anyone can read approved reviews"
  ON public.reviews FOR SELECT
  USING (status = 'approved');

-- Authenticated users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

-- Users can read own reviews (any status)
CREATE POLICY "Users can read own reviews"
  ON public.reviews FOR SELECT
  USING (auth.uid() = teacher_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
  ON public.reviews FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed existing testimonials as approved
INSERT INTO public.reviews (name, designation, institution, rating, text, status) VALUES
  ('রাহাত হোসেন', 'সহকারী শিক্ষক', 'রাজশাহী', 5, 'eExamapp ব্যবহার করে প্রশ্নপত্র তৈরি করা এখন অনেক সহজ হয়ে গেছে। সময় বাঁচে এবং মান বজায় থাকে।', 'approved'),
  ('ফাতেমা আক্তার', 'প্রধান শিক্ষক', 'চট্টগ্রাম', 5, 'আমাদের প্রতিষ্ঠানের সকল শিক্ষক এই প্ল্যাটফর্ম ব্যবহার করছেন। খুবই কার্যকর একটি টুল।', 'approved'),
  ('মো: আলী আহমেদ', 'বিষয় শিক্ষক', 'ঢাকা', 5, 'অধ্যায়ভিত্তিক eExamapp থেকে মডেল টেস্ট তৈরি করতে মাত্র কয়েক মিনিট লাগে।', 'approved');
