
-- helper: is the user admin of any site?
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  );
$$;

-- audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  table_name text NOT NULL,
  action text NOT NULL,
  row_id uuid,
  site_id uuid,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- generic trigger
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id uuid;
  v_site_id uuid;
  v_snapshot jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_snapshot := to_jsonb(OLD);
    v_row_id := (v_snapshot->>'id')::uuid;
    v_site_id := NULLIF(v_snapshot->>'site_id','')::uuid;
  ELSE
    v_snapshot := to_jsonb(NEW);
    v_row_id := (v_snapshot->>'id')::uuid;
    v_site_id := NULLIF(v_snapshot->>'site_id','')::uuid;
  END IF;

  INSERT INTO public.audit_log(actor_id, table_name, action, row_id, site_id, snapshot)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, v_row_id, v_site_id, v_snapshot);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- attach triggers
CREATE TRIGGER audit_sites
  AFTER INSERT OR UPDATE OR DELETE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER audit_user_sites
  AFTER INSERT OR UPDATE OR DELETE ON public.user_sites
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER audit_waste_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.waste_entries
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER audit_disposal_batches
  AFTER INSERT OR UPDATE OR DELETE ON public.disposal_batches
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
