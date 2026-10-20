INSERT INTO public.profiles (id, email, full_name, role_id)
SELECT '3d31a40b-45b2-4704-85b6-72a87b3f037a', 'admin@perusahaan.co.id', 'Administrator',
       (SELECT id FROM public.roles WHERE name = 'admin');