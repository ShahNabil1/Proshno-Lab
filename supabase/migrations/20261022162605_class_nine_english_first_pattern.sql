BEGIN;
-- A first-paper subject is missing in the Bangla-medium SSC class.
INSERT INTO public.subjects(class_id,name)
SELECT c.id,'English 1st Paper' FROM public.classes c
WHERE c.name ~* 'নবম|দশম|ssc|class[[:space:]]*(9|10)([^0-9]|$)'
AND NOT EXISTS(SELECT 1 FROM public.subjects s WHERE s.class_id=c.id AND s.name ~* 'english.*(1st|first)|ইংরেজি.*(১ম|প্রথম)');

WITH targets AS (
 SELECT s.id FROM public.subjects s JOIN public.classes c ON c.id=s.class_id
 WHERE c.name ~* 'নবম|দশম|ssc|class[[:space:]]*(9|10)([^0-9]|$)'
 AND s.name ~* 'english.*(1st|first)|ইংরেজি.*(১ম|প্রথম)'
), template AS (
 SELECT t.id subject_id,unnest(ARRAY[
 'Unit 1: Sense of Self','Unit 2: Climate Change','Unit 3: Pastimes','Unit 4: Events & Festivals',
 'Unit 5: Problems Around Us','Unit 6: Our Neighbours','Unit 7: People Who Stand Out',
 'Unit 8: World Heritage','Unit 9: Unconventional Jobs','Unit 10: Dreams',
 'Unit 11: Reading from English Literature','Unit 12: Roots','Unit 13: Loneliness',
 'Unit 14: Renewable Energy','Unit 15: Media and Modes of E-communication','Unit 16: Graffiti',
 'Unseen Comprehension','Matching','Rearranging Sentences','Answering Questions from Poems',
 'Answering Questions from Stories','Completing a Story','Writing Dialogue']) name FROM targets t
)
INSERT INTO public.chapters(subject_id,name,is_active)
SELECT t.subject_id,t.name,true FROM template t
WHERE NOT EXISTS(SELECT 1 FROM public.chapters ch WHERE ch.subject_id=t.subject_id AND lower(ch.name)=lower(t.name));

-- This is the one lesson explicitly identified by the supplied model paper.
INSERT INTO public.topics(chapter_id,name)
SELECT ch.id,'Lesson 1(A)' FROM public.chapters ch
JOIN public.subjects s ON s.id=ch.subject_id JOIN public.classes c ON c.id=s.class_id
WHERE c.name ~* 'নবম|দশম|ssc|class[[:space:]]*(9|10)([^0-9]|$)'
AND s.name ~* 'english.*(1st|first)|ইংরেজি.*(১ম|প্রথম)' AND ch.name='Unit 2: Climate Change'
AND NOT EXISTS(SELECT 1 FROM public.topics t WHERE t.chapter_id=ch.id AND t.name='Lesson 1(A)');
COMMIT;
