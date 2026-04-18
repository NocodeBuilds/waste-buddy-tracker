-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');
CREATE TYPE public.waste_category AS ENUM ('hazardous', 'non_hazardous');
CREATE TYPE public.activity_type AS ENUM ('breakdown', 'preventive');

-- ============ TIMESTAMP TRIGGER FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ SITES ============
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER_SITES ============
CREATE TABLE public.user_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id)
);
ALTER TABLE public.user_sites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_sites_user ON public.user_sites(user_id);
CREATE INDEX idx_user_sites_site ON public.user_sites(site_id);

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_site ON public.user_roles(site_id);

-- ============ DISPOSAL_BATCHES ============
CREATE TABLE public.disposal_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  disposed_date DATE NOT NULL,
  disposed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.disposal_batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_disposal_batches_site ON public.disposal_batches(site_id);

-- ============ WASTE_ENTRIES ============
CREATE TABLE public.waste_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  wtg_id TEXT NOT NULL,
  waste_type_id TEXT NOT NULL,
  waste_category public.waste_category NOT NULL DEFAULT 'hazardous',
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  generated_date DATE NOT NULL,
  activity_type public.activity_type NOT NULL,
  notes TEXT,
  disposal_batch_id UUID REFERENCES public.disposal_batches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.waste_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waste_entries_site ON public.waste_entries(site_id);
CREATE INDEX idx_waste_entries_batch ON public.waste_entries(disposal_batch_id);
CREATE TRIGGER trg_waste_entries_updated_at BEFORE UPDATE ON public.waste_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_site_access(_user_id UUID, _site_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sites
    WHERE user_id = _user_id AND site_id = _site_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_site_role(_user_id UUID, _site_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND site_id = _site_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_site_admin_or_manager(_user_id UUID, _site_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND site_id = _site_id AND role IN ('admin','manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_site_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT site_id FROM public.user_sites WHERE user_id = _user_id;
$$;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- SITES
CREATE POLICY "Users view sites they belong to"
  ON public.sites FOR SELECT TO authenticated
  USING (public.has_site_access(auth.uid(), id));
CREATE POLICY "Site admins update their site"
  ON public.sites FOR UPDATE TO authenticated
  USING (public.has_site_role(auth.uid(), id, 'admin'));

-- PROFILES
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- USER_SITES
CREATE POLICY "Users view own site memberships"
  ON public.user_sites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Site admins view all memberships of their sites"
  ON public.user_sites FOR SELECT TO authenticated
  USING (public.has_site_role(auth.uid(), site_id, 'admin'));
CREATE POLICY "Site admins manage memberships"
  ON public.user_sites FOR INSERT TO authenticated
  WITH CHECK (public.has_site_role(auth.uid(), site_id, 'admin'));
CREATE POLICY "Site admins delete memberships"
  ON public.user_sites FOR DELETE TO authenticated
  USING (public.has_site_role(auth.uid(), site_id, 'admin'));

-- USER_ROLES
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Site admins view roles in their sites"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_site_role(auth.uid(), site_id, 'admin'));
CREATE POLICY "Site admins manage roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_site_role(auth.uid(), site_id, 'admin'));
CREATE POLICY "Site admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_site_role(auth.uid(), site_id, 'admin'));
CREATE POLICY "Site admins delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_site_role(auth.uid(), site_id, 'admin'));

-- WASTE_ENTRIES
CREATE POLICY "Site members view entries"
  ON public.waste_entries FOR SELECT TO authenticated
  USING (public.has_site_access(auth.uid(), site_id));
CREATE POLICY "Site members insert entries"
  ON public.waste_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_site_access(auth.uid(), site_id) AND created_by = auth.uid());
CREATE POLICY "Site managers update entries"
  ON public.waste_entries FOR UPDATE TO authenticated
  USING (public.is_site_admin_or_manager(auth.uid(), site_id));
CREATE POLICY "Site managers delete entries"
  ON public.waste_entries FOR DELETE TO authenticated
  USING (public.is_site_admin_or_manager(auth.uid(), site_id));

-- DISPOSAL_BATCHES
CREATE POLICY "Site members view disposal batches"
  ON public.disposal_batches FOR SELECT TO authenticated
  USING (public.has_site_access(auth.uid(), site_id));
CREATE POLICY "Admins/managers create disposal batches"
  ON public.disposal_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_site_admin_or_manager(auth.uid(), site_id) AND disposed_by = auth.uid());
CREATE POLICY "Admins/managers update disposal batches"
  ON public.disposal_batches FOR UPDATE TO authenticated
  USING (public.is_site_admin_or_manager(auth.uid(), site_id));
CREATE POLICY "Admins/managers delete disposal batches"
  ON public.disposal_batches FOR DELETE TO authenticated
  USING (public.is_site_admin_or_manager(auth.uid(), site_id));

-- ============ SEED DEFAULT SITE ============
INSERT INTO public.sites (name, location) VALUES ('Main Site', 'Default Location');