-- Allow authenticated users to create sites; creator becomes admin + member
CREATE POLICY "Authenticated users can create sites"
ON public.sites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.handle_new_site()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid := auth.uid();
BEGIN
  IF creator IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.user_sites (user_id, site_id) VALUES (creator, NEW.id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, site_id, role) VALUES (creator, NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_site_created ON public.sites;
CREATE TRIGGER on_site_created
AFTER INSERT ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.handle_new_site();