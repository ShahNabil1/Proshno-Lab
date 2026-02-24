
-- Add chapters for various subjects
INSERT INTO public.chapters (subject_id, name) VALUES
  -- ষষ্ঠ বাংলা (subject 2)
  (2, 'মানবধর্ম'),
  (2, 'বাংলাদেশের হৃদয়'),
  -- ষষ্ঠ গণিত (subject 4)
  (4, 'স্বাভাবিক সংখ্যা'),
  (4, 'ভগ্নাংশ'),
  -- ষষ্ঠ বিজ্ঞান (subject 5)
  (5, 'পদার্থের বৈশিষ্ট্য'),
  (5, 'তাপ ও তাপমাত্রা'),
  -- নবম গণিত (subject 16)
  (16, 'সেট ও ফাংশন'),
  (16, 'বীজগাণিতিক রাশি'),
  (16, 'জ্যামিতিক ধারণা'),
  -- নবম পদার্থবিজ্ঞান (subject 17)
  (17, 'ভৌত রাশি ও পরিমাপ'),
  (17, 'গতি'),
  (17, 'বল'),
  -- নবম রসায়ন (subject 18)
  (18, 'রসায়নের পরিচিতি'),
  (18, 'পরমাণুর গঠন'),
  -- দশম গণিত (subject 22)
  (22, 'বাস্তব সংখ্যা'),
  (22, 'সূচক ও লগারিদম');

-- Add questions (teacher: 6abe3ed6-df14-47f7-9217-56382499ddeb)
-- Need to get chapter IDs first, use subject_id references
-- ষষ্ঠ গণিত - স্বাভাবিক সংখ্যা (will be chapter ~3 area, let's use subquery approach)

-- MCQ questions for ষষ্ঠ গণিত
INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  2, 4, c.id, 'mcq',
  '১২ এর গুণনীয়ক কয়টি?',
  '৪টি', '৬টি', '৫টি', '৮টি', 'খ'
FROM chapters c WHERE c.subject_id = 4 AND c.name = 'স্বাভাবিক সংখ্যা';

INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  2, 4, c.id, 'mcq',
  'সবচেয়ে ছোট মৌলিক সংখ্যা কত?',
  '০', '১', '২', '৩', 'গ'
FROM chapters c WHERE c.subject_id = 4 AND c.name = 'স্বাভাবিক সংখ্যা';

INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  2, 4, c.id, 'mcq',
  '২৪ ও ৩৬ এর গ.সা.গু কত?',
  '৬', '১২', '৮', '৪', 'খ'
FROM chapters c WHERE c.subject_id = 4 AND c.name = 'স্বাভাবিক সংখ্যা';

-- Short questions
INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  2, 4, c.id, 'short',
  'মৌলিক সংখ্যা কাকে বলে?',
  'যে সংখ্যা ১ এবং ঐ সংখ্যা ছাড়া অন্য কোনো সংখ্যা দ্বারা বিভাজ্য নয়, তাকে মৌলিক সংখ্যা বলে।'
FROM chapters c WHERE c.subject_id = 4 AND c.name = 'স্বাভাবিক সংখ্যা';

-- নবম পদার্থবিজ্ঞান MCQ
INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  5, 17, c.id, 'mcq',
  'আন্তর্জাতিক পদ্ধতিতে দৈর্ঘ্যের একক কী?',
  'সেন্টিমিটার', 'মিটার', 'কিলোমিটার', 'ফুট', 'খ'
FROM chapters c WHERE c.subject_id = 17 AND c.name = 'ভৌত রাশি ও পরিমাপ';

INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  5, 17, c.id, 'mcq',
  'ভরের SI একক কোনটি?',
  'গ্রাম', 'কিলোগ্রাম', 'পাউন্ড', 'টন', 'খ'
FROM chapters c WHERE c.subject_id = 17 AND c.name = 'ভৌত রাশি ও পরিমাপ';

-- Creative question
INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  5, 17, c.id, 'creative',
  'রহিম একটি স্কেল দিয়ে একটি বইয়ের দৈর্ঘ্য মাপলো। সে দেখলো বইটি ২৫ সেমি লম্বা।',
  'ভৌত রাশি কাকে বলে?',
  'দৈর্ঘ্য পরিমাপের প্রয়োজনীয়তা ব্যাখ্যা করো।',
  'রহিমের পরিমাপে কোন ধরনের ত্রুটি হতে পারে বিশ্লেষণ করো।',
  'পরিমাপের নির্ভুলতা বাড়ানোর উপায় মূল্যায়ন করো।'
FROM chapters c WHERE c.subject_id = 17 AND c.name = 'ভৌত রাশি ও পরিমাপ';

-- Descriptive question  
INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  5, 17, c.id, 'descriptive',
  'পরিমাপের আন্তর্জাতিক একক পদ্ধতি (SI) সম্পর্কে বিস্তারিত আলোচনা করো। মৌলিক ও লব্ধ একক উদাহরণসহ ব্যাখ্যা করো।'
FROM chapters c WHERE c.subject_id = 17 AND c.name = 'ভৌত রাশি ও পরিমাপ';

-- নবম রসায়ন MCQ
INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  5, 18, c.id, 'mcq',
  'পরমাণুর নিউক্লিয়াসে কী থাকে?',
  'ইলেকট্রন ও প্রোটন', 'প্রোটন ও নিউট্রন', 'ইলেকট্রন ও নিউট্রন', 'শুধু প্রোটন', 'খ'
FROM chapters c WHERE c.subject_id = 18 AND c.name = 'পরমাণুর গঠন';

INSERT INTO public.questions (teacher_id, class_id, subject_id, chapter_id, type, question, option_a, option_b, option_c, option_d, correct_answer)
SELECT 
  '6abe3ed6-df14-47f7-9217-56382499ddeb',
  5, 18, c.id, 'mcq',
  'ইলেকট্রনের চার্জ কত?',
  '+1.6×10⁻¹⁹ C', '-1.6×10⁻¹⁹ C', '0', '+1 C', 'খ'
FROM chapters c WHERE c.subject_id = 18 AND c.name = 'পরমাণুর গঠন';

-- Add question categories
INSERT INTO public.question_categories (name) VALUES
  ('জ্ঞানমূলক'),
  ('অনুধাবনমূলক'),
  ('প্রয়োগমূলক'),
  ('উচ্চতর দক্ষতা')
ON CONFLICT DO NOTHING;
