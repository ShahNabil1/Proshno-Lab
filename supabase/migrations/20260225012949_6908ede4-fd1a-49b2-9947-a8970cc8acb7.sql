-- Add status and admin_reply columns to feedback
ALTER TABLE public.feedback 
ADD COLUMN status text NOT NULL DEFAULT 'pending',
ADD COLUMN admin_reply text DEFAULT '';

-- Allow admins to update feedback (for status & reply)
CREATE POLICY "Admins can update feedback"
ON public.feedback
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));