INSERT INTO public.user_roles (user_id, role, allowed_pages)
SELECT t.id, 'developer'::public.app_role, NULL
FROM public.teachers t
WHERE t.email = 'shahriarnabil94@gmail.com'
ON CONFLICT (user_id, role) DO UPDATE SET allowed_pages = NULL;

INSERT INTO public.user_roles (user_id, role, allowed_pages)
SELECT t.id, 'admin'::public.app_role, NULL
FROM public.teachers t
WHERE t.email = 'shahriarnabil94@gmail.com'
ON CONFLICT (user_id, role) DO UPDATE SET allowed_pages = NULL;

DELETE FROM public.user_permissions up
USING public.teachers t
WHERE up.user_id = t.id AND t.email = 'shahriarnabil94@gmail.com';