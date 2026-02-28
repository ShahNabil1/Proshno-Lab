
-- Drop the existing insert policy that requires auth
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;

-- Allow anyone to insert reviews (teacher_id will be null for anonymous)
CREATE POLICY "Anyone can insert reviews"
ON public.reviews
FOR INSERT
WITH CHECK (true);
