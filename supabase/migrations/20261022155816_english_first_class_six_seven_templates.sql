BEGIN;
-- Use the existing lower-secondary chapter templates; never copy Class 8 questions.
WITH targets AS (
 SELECT s.id subject_id,
 CASE WHEN c.name ~* 'ষষ্ঠ|class[[:space:]]*6([^0-9]|$)' THEN 6 ELSE 7 END grade
 FROM public.subjects s JOIN public.classes c ON c.id=s.class_id
 WHERE c.name ~* 'ষষ্ঠ|সপ্তম|class[[:space:]]*[67]([^0-9]|$)'
 AND s.name ~* 'english.*(1st|first)|ইংরেজি.*(১ম|প্রথম)'
), template AS (
 SELECT subject_id, unnest(CASE WHEN grade=6 THEN ARRAY['Seen Comprehension'] ELSE
 ARRAY['Unit 1: Attention, Please','Unit 2: My Study Guide','Unit 3: What are Friends for?',
 'Unit 4: People Who Make a Difference','Unit 5: Great Woman to Remember','Unit 6: Leisure',
 'Unit 7: Games and Sports','Unit 8: Likes and Dislikes','Unit 9: Climate Change'] END ||
 ARRAY['Unseen Comprehension','Matching','Rearranging Sentences','Answering Questions from Poems',
 'Completing a Story','Writing Paragraph','Writing Dialogue']) name FROM targets
)
INSERT INTO public.chapters(subject_id,name,is_active)
SELECT t.subject_id,t.name,true FROM template t
WHERE NOT EXISTS(SELECT 1 FROM public.chapters ch WHERE ch.subject_id=t.subject_id AND lower(ch.name)=lower(t.name));
COMMIT;

