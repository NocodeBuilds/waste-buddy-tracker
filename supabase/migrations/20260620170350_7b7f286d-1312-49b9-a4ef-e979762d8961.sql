-- Delete all user-related data and accounts
DELETE FROM public.audit_log;
DELETE FROM public.waste_entries;
DELETE FROM public.disposal_batches;
DELETE FROM public.user_roles;
DELETE FROM public.user_sites;
DELETE FROM public.profiles;
DELETE FROM auth.users;