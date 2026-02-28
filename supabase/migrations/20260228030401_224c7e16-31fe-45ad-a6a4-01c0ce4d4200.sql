
-- Create FAQs table
CREATE TABLE public.faqs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Public read for active FAQs
CREATE POLICY "Anyone can read active faqs"
  ON public.faqs FOR SELECT
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage faqs"
  ON public.faqs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed existing FAQ data
INSERT INTO public.faqs (question, answer, sort_order) VALUES
  ('eExamapp এর সেবা সমূহ কি কি?', 'আমরা ১ ক্লিকে প্রশ্ন তৈরি, অধ্যায়ভিত্তিক eExamapp, অনলাইন পরীক্ষা এবং OMR মূল্যায়ন সেবা প্রদান করি।', 1),
  ('১ ক্লিকে প্রশ্ন তৈরীতে কি কি কাস্টমাইজ করা যাবে?', 'শ্রেণি, বিষয়, অধ্যায়, প্রশ্নের ধরন, নম্বর বণ্টন, সময় এবং প্রতিষ্ঠানের তথ্য কাস্টমাইজ করা যায়।', 2),
  ('কি কি উপায়ে প্রশ্ন বাছাই করা যাবে?', 'শ্রেণি, বিষয়, অধ্যায়, বোর্ড, সাল এবং প্রশ্নের ধরন অনুযায়ী ফিল্টার করে প্রশ্ন বাছাই করা যায়।', 3),
  ('OMR Evaluator Features কি কি?', 'স্বয়ংক্রিয় OMR শীট মূল্যায়ন, ফলাফল বিশ্লেষণ, মেরিট লিস্ট তৈরি এবং রিপোর্ট জেনারেশন।', 4),
  ('সাবস্ক্রিপশন এর মেয়াদ, লিমিট আছে কি?', 'প্যাকেজ ভেদে মেয়াদ ও লিমিট ভিন্ন। বিস্তারিত মূল্য তালিকা পাতায় দেখুন।', 5);
