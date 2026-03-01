
-- Assign developer role to shahriarnabil94@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('19cae243-b694-4804-afb0-c1bb80f9f33f', 'developer')
ON CONFLICT (user_id, role) DO NOTHING;
