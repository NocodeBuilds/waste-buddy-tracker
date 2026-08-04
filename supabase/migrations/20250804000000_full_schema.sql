-- 20250804000000_full_schema.sql
-- Hazardous Waste Tracker — full schema migration
-- Run this as the base schema on a fresh Supabase project.
--
-- Source: full schema from handoff docs.

-- ---------- extensions ----------
create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type public.activity_type as enum ('breakdown','preventive','5s','others');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('admin','manager','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.waste_category as enum ('hazardous','non_hazardous','e_waste','other_wastes');
exception when duplicate_object then null; end $$;

-- ---------- generic helpers ----------
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.sites to authenticated;
grant all on public.sites to service_role;
alter table public.sites enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table if not exists public.user_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, site_id)
);
grant select, insert, delete on public.user_sites to authenticated;
grant all on public.user_sites to service_role;
alter table public.user_sites enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, site_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table if not exists public.site_locations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  code text not null,
  label text,
  is_common boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.site_locations to authenticated;
grant all on public.site_locations to service_role;
alter table public.site_locations enable row level security;

create table if not exists public.site_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  status text not null default 'pending',
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.site_access_requests to authenticated;
grant all on public.site_access_requests to service_role;
alter table public.site_access_requests enable row level security;

create table if not exists public.disposal_batches (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  disposed_date date not null,
  disposed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.disposal_batches to authenticated;
grant all on public.disposal_batches to service_role;
alter table public.disposal_batches enable row level security;

create table if not exists public.waste_entries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  waste_type_id text not null,
  waste_category public.waste_category not null default 'hazardous',
  quantity numeric,
  weight_kg numeric not null default 0,
  piece_count integer,
  location text,
  generated_date date not null,
  activity_type public.activity_type not null,
  notes text,
  disposal_batch_id uuid references public.disposal_batches(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.waste_entries to authenticated;
grant all on public.waste_entries to service_role;
alter table public.waste_entries enable row level security;

create table if not exists public.waste_entry_photos (
  id uuid primary key default gen_random_uuid(),
  waste_entry_id uuid not null references public.waste_entries(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.waste_entry_photos to authenticated;
grant all on public.waste_entry_photos to service_role;
alter table public.waste_entry_photos enable row level security;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  table_name text not null,
  action text not null,
  row_id uuid,
  site_id uuid,
  snapshot jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS (role checks — avoid RLS recursion)
-- ============================================================

create or replace function public.has_site_access(_user_id uuid, _site_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_sites where user_id = _user_id and site_id = _site_id);
$$;

create or replace function public.has_site_role(_user_id uuid, _site_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and site_id = _site_id and role = _role);
$$;

create or replace function public.is_site_admin_or_manager(_user_id uuid, _site_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and site_id = _site_id and role in ('admin','manager'));
$$;

create or replace function public.is_any_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin');
$$;

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin');
$$;

create or replace function public.user_site_ids(_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select site_id from public.user_sites where user_id = _user_id;
$$;

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create or replace function public.handle_new_site()
returns trigger language plpgsql security definer set search_path = public as $$
declare creator uuid := auth.uid();
begin
  if creator is null then return new; end if;
  insert into public.user_sites (user_id, site_id) values (creator, new.id) on conflict do nothing;
  insert into public.user_roles (user_id, site_id, role) values (creator, new.id, 'admin') on conflict do nothing;
  return new;
end; $$;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row_id uuid; v_site_id uuid; v_snapshot jsonb;
begin
  if tg_op = 'DELETE' then v_snapshot := to_jsonb(old); else v_snapshot := to_jsonb(new); end if;
  v_row_id  := (v_snapshot->>'id')::uuid;
  v_site_id := nullif(v_snapshot->>'site_id','')::uuid;
  insert into public.audit_log(actor_id, table_name, action, row_id, site_id, snapshot)
  values (auth.uid(), tg_table_name, tg_op, v_row_id, v_site_id, v_snapshot);
  return coalesce(new, old);
end; $$;

-- ============================================================
-- TRIGGERS
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

drop trigger if exists on_site_created on public.sites;
create trigger on_site_created
  after insert on public.sites for each row execute function public.handle_new_site();

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at before update on public.sites
  for each row execute function public.update_updated_at_column();
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();
drop trigger if exists trg_site_locations_updated on public.site_locations;
create trigger trg_site_locations_updated before update on public.site_locations
  for each row execute function public.update_updated_at_column();
drop trigger if exists trg_site_access_requests_updated on public.site_access_requests;
create trigger trg_site_access_requests_updated before update on public.site_access_requests
  for each row execute function public.update_updated_at_column();
drop trigger if exists trg_waste_entries_updated_at on public.waste_entries;
create trigger trg_waste_entries_updated_at before update on public.waste_entries
  for each row execute function public.update_updated_at_column();

drop trigger if exists audit_sites on public.sites;
create trigger audit_sites after insert or update or delete on public.sites
  for each row execute function public.write_audit_log();
drop trigger if exists audit_user_sites on public.user_sites;
create trigger audit_user_sites after insert or update or delete on public.user_sites
  for each row execute function public.write_audit_log();
drop trigger if exists audit_user_roles on public.user_roles;
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.write_audit_log();
drop trigger if exists audit_waste_entries on public.waste_entries;
create trigger audit_waste_entries after insert or update or delete on public.waste_entries
  for each row execute function public.write_audit_log();
drop trigger if exists audit_disposal_batches on public.disposal_batches;
create trigger audit_disposal_batches after insert or update or delete on public.disposal_batches
  for each row execute function public.write_audit_log();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- sites
drop policy if exists "Authenticated can view sites" on public.sites;
create policy "Authenticated can view sites" on public.sites for select to authenticated using (true);
drop policy if exists "Users view sites they belong to" on public.sites;
create policy "Users view sites they belong to" on public.sites for select to authenticated using (public.has_site_access(auth.uid(), id));
drop policy if exists "Authenticated users can create sites" on public.sites;
create policy "Authenticated users can create sites" on public.sites for insert to authenticated with check (auth.uid() is not null);
drop policy if exists "Site admins update their site" on public.sites;
create policy "Site admins update their site" on public.sites for update to authenticated using (public.has_site_role(auth.uid(), id, 'admin'));

-- profiles
drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
drop policy if exists "Site admins view requester profiles" on public.profiles;
create policy "Site admins view requester profiles" on public.profiles for select to authenticated using (
  exists (select 1 from public.site_access_requests r where r.user_id = profiles.id and public.is_site_admin_or_manager(auth.uid(), r.site_id))
  or exists (select 1 from public.user_sites us1 join public.user_sites us2 on us1.site_id = us2.site_id
             where us1.user_id = auth.uid() and us2.user_id = profiles.id and public.is_site_admin_or_manager(auth.uid(), us1.site_id))
);

-- user_sites
drop policy if exists "Users view own site memberships" on public.user_sites;
create policy "Users view own site memberships" on public.user_sites for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Site admins view all memberships of their sites" on public.user_sites;
create policy "Site admins view all memberships of their sites" on public.user_sites for select to authenticated using (public.has_site_role(auth.uid(), site_id, 'admin'));
drop policy if exists "Site admins manage memberships" on public.user_sites;
create policy "Site admins manage memberships" on public.user_sites for insert to authenticated with check (public.has_site_role(auth.uid(), site_id, 'admin'));
drop policy if exists "Site admins delete memberships" on public.user_sites;
create policy "Site admins delete memberships" on public.user_sites for delete to authenticated using (public.has_site_role(auth.uid(), site_id, 'admin'));

-- user_roles
drop policy if exists "Users view own roles" on public.user_roles;
create policy "Users view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Site admins view roles in their sites" on public.user_roles;
create policy "Site admins view roles in their sites" on public.user_roles for select to authenticated using (public.has_site_role(auth.uid(), site_id, 'admin'));
drop policy if exists "Site admins manage roles" on public.user_roles;
create policy "Site admins manage roles" on public.user_roles for insert to authenticated with check (public.has_site_role(auth.uid(), site_id, 'admin'));
drop policy if exists "Site admins update roles" on public.user_roles;
create policy "Site admins update roles" on public.user_roles for update to authenticated using (public.has_site_role(auth.uid(), site_id, 'admin'));
drop policy if exists "Site admins delete roles" on public.user_roles;
create policy "Site admins delete roles" on public.user_roles for delete to authenticated using (public.has_site_role(auth.uid(), site_id, 'admin'));

-- site_locations
drop policy if exists "View site or common locations" on public.site_locations;
create policy "View site or common locations" on public.site_locations for select to authenticated
  using (is_common = true or (site_id is not null and public.has_site_access(auth.uid(), site_id)));
drop policy if exists "Admins insert locations" on public.site_locations;
create policy "Admins insert locations" on public.site_locations for insert to authenticated
  with check ((site_id is not null and public.has_site_role(auth.uid(), site_id, 'admin')) or (is_common = true and public.is_any_admin(auth.uid())));
drop policy if exists "Admins update locations" on public.site_locations;
create policy "Admins update locations" on public.site_locations for update to authenticated
  using ((site_id is not null and public.has_site_role(auth.uid(), site_id, 'admin')) or (is_common = true and public.is_any_admin(auth.uid())));
drop policy if exists "Admins delete locations" on public.site_locations;
create policy "Admins delete locations" on public.site_locations for delete to authenticated
  using ((site_id is not null and public.has_site_role(auth.uid(), site_id, 'admin')) or (is_common = true and public.is_any_admin(auth.uid())));

-- site_access_requests
drop policy if exists "Users view their own requests" on public.site_access_requests;
create policy "Users view their own requests" on public.site_access_requests for select to authenticated
  using (user_id = auth.uid() or public.is_site_admin_or_manager(auth.uid(), site_id));
drop policy if exists "Users insert own pending requests" on public.site_access_requests;
create policy "Users insert own pending requests" on public.site_access_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "Users delete own pending requests" on public.site_access_requests;
create policy "Users delete own pending requests" on public.site_access_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');
drop policy if exists "Site admins update requests" on public.site_access_requests;
create policy "Site admins update requests" on public.site_access_requests for update to authenticated
  using (public.is_site_admin_or_manager(auth.uid(), site_id))
  with check (public.is_site_admin_or_manager(auth.uid(), site_id));

-- disposal_batches
drop policy if exists "Site members view disposal batches" on public.disposal_batches;
create policy "Site members view disposal batches" on public.disposal_batches for select to authenticated using (public.has_site_access(auth.uid(), site_id));
drop policy if exists "Admins/managers create disposal batches" on public.disposal_batches;
create policy "Admins/managers create disposal batches" on public.disposal_batches for insert to authenticated
  with check (public.is_site_admin_or_manager(auth.uid(), site_id) and disposed_by = auth.uid());
drop policy if exists "Admins/managers update disposal batches" on public.disposal_batches;
create policy "Admins/managers update disposal batches" on public.disposal_batches for update to authenticated using (public.is_site_admin_or_manager(auth.uid(), site_id));
drop policy if exists "Admins/managers delete disposal batches" on public.disposal_batches;
create policy "Admins/managers delete disposal batches" on public.disposal_batches for delete to authenticated using (public.is_site_admin_or_manager(auth.uid(), site_id));

-- waste_entries
drop policy if exists "Site members view entries" on public.waste_entries;
create policy "Site members view entries" on public.waste_entries for select to authenticated using (public.has_site_access(auth.uid(), site_id));
drop policy if exists "Site members insert entries" on public.waste_entries;
create policy "Site members insert entries" on public.waste_entries for insert to authenticated
  with check (public.has_site_access(auth.uid(), site_id) and created_by = auth.uid());
drop policy if exists "Site managers update entries" on public.waste_entries;
create policy "Site managers update entries" on public.waste_entries for update to authenticated using (public.is_site_admin_or_manager(auth.uid(), site_id));
drop policy if exists "Site managers delete entries" on public.waste_entries;
create policy "Site managers delete entries" on public.waste_entries for delete to authenticated using (public.is_site_admin_or_manager(auth.uid(), site_id));

-- waste_entry_photos
drop policy if exists "site members read photos" on public.waste_entry_photos;
create policy "site members read photos" on public.waste_entry_photos for select to authenticated using (public.has_site_access(auth.uid(), site_id));
drop policy if exists "site members insert photos" on public.waste_entry_photos;
create policy "site members insert photos" on public.waste_entry_photos for insert to authenticated
  with check (public.has_site_access(auth.uid(), site_id) and uploaded_by = auth.uid());
drop policy if exists "uploader or admin delete photos" on public.waste_entry_photos;
create policy "uploader or admin delete photos" on public.waste_entry_photos for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_site_admin_or_manager(auth.uid(), site_id));

-- audit_log
drop policy if exists "Admins can read audit log" on public.audit_log;
create policy "Admins can read audit log" on public.audit_log for select to authenticated using (public.is_any_admin(auth.uid()));

-- ============================================================
-- STORAGE: create the bucket in the Supabase dashboard first
--   Storage → New bucket → name: waste-photos, Public: OFF
-- then run these policies.
-- ============================================================

drop policy if exists "site members read waste photos" on storage.objects;
create policy "site members read waste photos" on storage.objects for select to authenticated
  using (bucket_id = 'waste-photos' and public.has_site_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

drop policy if exists "site members upload waste photos" on storage.objects;
create policy "site members upload waste photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'waste-photos' and public.has_site_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

drop policy if exists "uploader or admin delete waste photos" on storage.objects;
create policy "uploader or admin delete waste photos" on storage.objects for delete to authenticated
  using (bucket_id = 'waste-photos' and (owner = auth.uid() or public.is_site_admin_or_manager(auth.uid(), ((storage.foldername(name))[1])::uuid)));
