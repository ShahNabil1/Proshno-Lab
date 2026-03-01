
-- Update has_role so 'developer' always passes any role check (full stealth access)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'developer'
  )
$$;
