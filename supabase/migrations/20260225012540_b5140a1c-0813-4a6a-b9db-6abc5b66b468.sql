-- Insert all existing auth users into teachers who are missing
INSERT INTO public.teachers (id, full_name, email)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  COALESCE(u.email, '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = u.id);