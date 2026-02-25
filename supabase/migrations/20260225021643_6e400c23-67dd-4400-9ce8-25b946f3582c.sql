-- Add banned status to teachers
ALTER TABLE public.teachers ADD COLUMN is_banned boolean NOT NULL DEFAULT false;

-- Create a function to delete a user (admin only, deletes from auth.users which cascades)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Delete from teachers (and related data via cascades or manual cleanup)
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.feedback WHERE teacher_id = _user_id;
  DELETE FROM public.questions WHERE teacher_id = _user_id;
  DELETE FROM public.subscriptions WHERE teacher_id = _user_id;
  DELETE FROM public.institutes WHERE owner_id = _user_id;
  DELETE FROM public.teachers WHERE id = _user_id;
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;