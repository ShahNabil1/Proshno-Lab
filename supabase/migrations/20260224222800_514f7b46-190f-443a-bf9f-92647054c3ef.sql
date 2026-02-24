
-- Add subject_code column to subjects table
ALTER TABLE public.subjects ADD COLUMN subject_code text DEFAULT NULL;

-- Add demo subject codes for existing subjects
UPDATE public.subjects SET subject_code = '১৭৮' WHERE name ILIKE '%জীববিজ্ঞান%' OR name ILIKE '%Biology%';
UPDATE public.subjects SET subject_code = '১০৯' WHERE name ILIKE '%গণিত%' OR name ILIKE '%Math%';
UPDATE public.subjects SET subject_code = '১৭৪' WHERE name ILIKE '%পদার্থ%' OR name ILIKE '%Physics%';
UPDATE public.subjects SET subject_code = '১৭৬' WHERE name ILIKE '%রসায়ন%' OR name ILIKE '%Chemistry%';
UPDATE public.subjects SET subject_code = '১০১' WHERE name ILIKE '%বাংলা%' OR name ILIKE '%Bangla%';
UPDATE public.subjects SET subject_code = '১০৭' WHERE name ILIKE '%ইংরেজি%' OR name ILIKE '%English%';
UPDATE public.subjects SET subject_code = '১৭০' WHERE name ILIKE '%তথ্য%' OR name ILIKE '%ICT%';
