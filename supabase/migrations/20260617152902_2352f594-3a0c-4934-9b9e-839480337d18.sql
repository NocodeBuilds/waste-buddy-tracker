-- Remove all existing admin role assignments and any auth users that had only admin role
DELETE FROM public.user_roles WHERE role = 'admin';
-- Remove orphan auth users that have no remaining roles (the bootstrap admin)
DELETE FROM auth.users WHERE id IN (
  SELECT u.id FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  WHERE r.user_id IS NULL
);