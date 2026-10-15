-- Forward-only hardening. No accounts, memberships, roles or waste records are reset.
-- Apply on staging and deploy the RPC-aware clients/functions together (see docs/REMEDIATION.md).
begin;

-- Old installations without approval support contain completed disposals. Preserve them.
alter table public.disposal_batches add column if not exists status text not null default 'approved';
alter table public.disposal_batches alter column status set default 'pending';
alter table public.disposal_batches add column if not exists requested_at timestamptz default now();
alter table public.disposal_batches add column if not exists approved_by uuid references auth.users(id);
alter table public.disposal_batches add column if not exists approved_at timestamptz;
alter table public.disposal_batches add column if not exists rejection_reason text;
alter table public.sites add column if not exists archived_at timestamptz;
alter table public.waste_entries add column if not exists expected_photo_count integer not null default 0;

-- Restrictive policies compose with EVERY old permissive policy, including drifted installs.
create policy hardened_site_creation on public.sites as restrictive for insert to authenticated
  with check (public.is_any_admin(auth.uid()));
revoke delete on public.sites from authenticated;
revoke update on public.profiles from authenticated;
grant update(full_name) on public.profiles to authenticated;
-- All role/membership changes are one transaction with an authenticated actor.
revoke insert, update, delete on public.user_roles, public.user_sites from authenticated;
revoke update on public.site_access_requests from authenticated;
create policy own_pending_request_delete on public.site_access_requests as restrictive for delete to authenticated
using(user_id=auth.uid() and status='pending');
create policy hardened_access_request on public.site_access_requests as restrictive for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and decided_by is null and decided_at is null);
create or replace function public.guard_access_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || new.site_id::text,0));
  if length(new.note)>5000 or exists(select 1 from public.sites where id=new.site_id and archived_at is not null) then raise exception 'Invalid access request'; end if;
  if exists(select 1 from public.site_access_requests where user_id=new.user_id and site_id=new.site_id and status='pending') then
    raise exception 'An access request is already pending' using errcode='23505';
  end if;
  return new;
end $$;
create trigger hardened_request before insert on public.site_access_requests for each row execute function public.guard_access_request();

create or replace function public.manage_site_access(
  p_action text, p_site_id uuid, p_user_id uuid default null, p_role public.app_role default 'member',
  p_request_id uuid default null, p_note text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target uuid := p_user_id; request public.site_access_requests; n integer;
begin
  perform 1 from public.sites where id = p_site_id for update;
  if not found or auth.uid() is null or not public.has_site_role(auth.uid(), p_site_id, 'admin') then
    raise exception 'Site administrator required' using errcode = '42501';
  end if;
  if length(p_note) > 5000 then raise exception 'Note too long'; end if;
  if p_action in ('approve_request','reject_request') then
    select * into request from public.site_access_requests where id=p_request_id and site_id=p_site_id for update;
    if not found or request.status <> 'pending' then raise exception 'Request is missing or already decided'; end if;
    target := request.user_id;
  end if;
  if target is null then raise exception 'User required'; end if;
  if p_action is null then raise exception 'Action required'; end if;
  if p_action in ('assign','approve_request') then
    if p_role is null or p_role = 'admin' then raise exception 'Administrator grants require a reviewed operator procedure'; end if;
    insert into public.user_sites(user_id,site_id) values(target,p_site_id) on conflict do nothing;
    insert into public.user_roles(user_id,site_id,role) values(target,p_site_id,p_role) on conflict do nothing;
  elsif p_action in ('revoke_role','remove_from_site') then
    if (p_action = 'remove_from_site' or p_role = 'admin') and public.has_site_role(target,p_site_id,'admin') then
      select count(*) into n from public.user_roles where site_id=p_site_id and role='admin';
      if n <= 1 then raise exception 'Cannot remove the last site administrator'; end if;
    end if;
    if p_action = 'remove_from_site' then
      delete from public.user_roles where user_id=target and site_id=p_site_id;
      delete from public.user_sites where user_id=target and site_id=p_site_id;
    else
      delete from public.user_roles where user_id=target and site_id=p_site_id and role=p_role;
      if not found then raise exception 'Role is missing or already removed'; end if;
    end if;
  elsif p_action <> 'reject_request' then raise exception 'Unknown action';
  end if;
  if p_action in ('approve_request','reject_request') then
    update public.site_access_requests set status=case when p_action='approve_request' then 'approved' else 'rejected' end,
      decided_by=auth.uid(), decided_at=now(), note=coalesce(p_note,note) where id=p_request_id;
  end if;
end $$;
revoke all on function public.manage_site_access(text,uuid,uuid,public.app_role,uuid,text) from public, anon;
grant execute on function public.manage_site_access(text,uuid,uuid,public.app_role,uuid,text) to authenticated;

-- A dedicated projection avoids recursive membership policies and exposes only relevant profiles.
create or replace function public.can_view_profile(p_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select p_id=auth.uid() or exists (
   select 1 from public.user_sites m where m.user_id=p_id and public.is_site_admin_or_manager(auth.uid(),m.site_id)
 ) or exists (
   select 1 from public.site_access_requests r where r.user_id=p_id and r.status='pending'
   and public.has_site_role(auth.uid(),r.site_id,'admin')
 );
$$;
revoke all on function public.can_view_profile(uuid) from public,anon;
grant execute on function public.can_view_profile(uuid) to authenticated;
create policy relevant_profiles_only on public.profiles as restrictive for select to authenticated using(public.can_view_profile(id));
create policy relevant_profiles on public.profiles for select to authenticated using(public.can_view_profile(id));

create table if not exists public.waste_type_catalog(id text primary key, category public.waste_category not null);
alter table public.waste_type_catalog enable row level security;
grant select on public.waste_type_catalog to authenticated;
create policy catalog_read on public.waste_type_catalog for select to authenticated using(true);
insert into public.waste_type_catalog(id,category) values ('oil-cotton','hazardous'),
('waste-oil','hazardous'),
('waste-grease','hazardous'),
('plastic-waste','hazardous'),
('hu-oil-filter','hazardous'),
('gb-oil-filter','hazardous'),
('gb-oil-filter-offline','hazardous'),
('dust-filter-mat','hazardous'),
('carbon-brush','hazardous'),
('oil-filters-misc','hazardous'),
('empty-containers','hazardous'),
('oil-hose','hazardous'),
('plastic-cartridge-perma','hazardous'),
('plastic-cartridge-breather','hazardous'),
('silica-gel','hazardous'),
('yaw-clipper-oil-seal','hazardous'),
('pitch-cylinder-oil-seal','hazardous'),
('empty-tins','hazardous'),
('paper-waste','non_hazardous'),
('packaging-waste','non_hazardous'),
('wooden-boxes','non_hazardous'),
('plastic-non-contaminated','non_hazardous'),
('non-haz-others','non_hazardous'),
('used-batteries','e_waste'),
('e-waste-circuit-boards','e_waste'),
('e-waste-general','e_waste'),
('e-waste-igbts','e_waste'),
('e-waste-diodes','e_waste'),
('e-waste-thyristors','e_waste'),
('e-waste-resistors','e_waste'),
('e-waste-capacitors','e_waste'),
('e-waste-others','e_waste'),
('aluminium-scrap','other_wastes'),
('copper-scrap','other_wastes'),
('ms-scrap','other_wastes'),
('plastic-scrap','other_wastes'),
('frp-scrap','other_wastes'),
('scrap-insulator','other_wastes'),
('rubber-scrap','other_wastes') on conflict do nothing;

-- Status transitions can ONLY occur through the transaction below, never a client UPDATE.
create or replace function public.guard_disposal_batch() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if current_user in ('authenticated','anon','service_role') then
    if tg_op='DELETE' then raise exception 'Use the disposal workflow'; end if;
    if tg_op='INSERT' then
      if new.status <> 'pending' or new.approved_by is not null or new.approved_at is not null then
        raise exception 'New disposals must be pending';
      end if;
    elsif new is distinct from old then raise exception 'Use the disposal workflow';
    end if;
  end if;
  if tg_op <> 'DELETE' and (new.status not in ('pending','approved','rejected') or length(new.notes)>5000) then
    raise exception 'Invalid disposal';
  end if;
  return coalesce(new,old);
end $$;
create trigger hardened_disposal before insert or update or delete on public.disposal_batches
for each row execute function public.guard_disposal_batch();

create or replace function public.guard_waste_entry() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare batch public.disposal_batches;
begin
  if tg_op in ('UPDATE','DELETE') and old.disposal_batch_id is not null then
    select * into batch from public.disposal_batches where id=old.disposal_batch_id for update;
    if batch.status='approved' or (tg_op='DELETE' and batch.status='pending') then raise exception 'Disposal evidence is immutable; reject a pending request before deletion'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.expected_photo_count<0 or new.expected_photo_count>10 then raise exception 'Invalid expected photo count'; end if;
  if tg_op='UPDATE' and current_user in ('authenticated','anon','service_role') and new.expected_photo_count<>old.expected_photo_count then raise exception 'Photo expectations are managed by the evidence workflow'; end if;
  if tg_op='INSERT' or new.waste_type_id is distinct from old.waste_type_id or new.waste_category is distinct from old.waste_category then
    if not exists(select 1 from public.waste_type_catalog where id=new.waste_type_id and category=new.waste_category) then raise exception 'Unknown waste type or category mismatch'; end if;
  end if;
  if tg_op='UPDATE' and (new.site_id<>old.site_id or new.created_by is distinct from old.created_by or new.id<>old.id) then
    raise exception 'Entry identity and ownership cannot change';
  end if;
  -- Validate changed fields only: legacy records remain readable and can receive unrelated corrections.
  if tg_op='INSERT' or new.weight_kg is distinct from old.weight_kg then
    if new.weight_kg <= 0 or new.weight_kg > 1000000000 or new.weight_kg::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid weight'; end if;
  end if;
  if new.piece_count < 0 or new.piece_count > 1000000000 or length(new.notes)>5000 or length(new.location)>500 then raise exception 'Invalid entry values'; end if;
  if (tg_op='INSERT' or new.generated_date is distinct from old.generated_date) and new.generated_date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'Future generation date'; end if;
  if new.disposal_batch_id is not null then
    if (select count(*) from public.waste_entry_photos where waste_entry_id=new.id)<new.expected_photo_count then raise exception 'Finish syncing photo evidence before requesting disposal'; end if;
    select * into batch from public.disposal_batches where id=new.disposal_batch_id for update;
    if not found or batch.site_id<>new.site_id then raise exception 'Disposal site mismatch'; end if;
    if current_user in ('authenticated','anon','service_role') and (batch.status<>'pending' or not public.is_site_admin_or_manager(auth.uid(),new.site_id)) then raise exception 'Invalid disposal link'; end if;
    if tg_op='UPDATE' and old.disposal_batch_id is not null and old.disposal_batch_id<>new.disposal_batch_id then raise exception 'Entry already reserved for disposal'; end if;
  end if;
  if tg_op='UPDATE' and old.disposal_batch_id is not null and current_user in ('authenticated','anon','service_role') then
    raise exception 'Pending disposal evidence must be rejected before editing';
  end if;
  return new;
end $$;
create trigger hardened_waste_entry before insert or update or delete on public.waste_entries
for each row execute function public.guard_waste_entry();

create or replace function public.create_disposal_request(p_id uuid, p_site_id uuid, p_date date, p_entry_ids uuid[], p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; existing public.disposal_batches;
begin
  perform 1 from public.sites where id=p_site_id for update;
  if not found or auth.uid() is null or not public.is_site_admin_or_manager(auth.uid(),p_site_id) then raise exception 'Manager required' using errcode='42501'; end if;
  select * into existing from public.disposal_batches where id=p_id;
  if found then
    if existing.site_id=p_site_id and existing.disposed_by=auth.uid() then return p_id; end if;
    raise exception 'Request identity conflict';
  end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Kolkata')::date or coalesce(cardinality(p_entry_ids),0)=0 or cardinality(p_entry_ids)>10000 then raise exception 'Choose a valid date and explicit entries'; end if;
  perform 1 from public.waste_entries where id=any(p_entry_ids) order by id for update;
  select count(*) into n from public.waste_entries where id=any(p_entry_ids) and site_id=p_site_id and disposal_batch_id is null and generated_date<=p_date;
  if n<>cardinality(p_entry_ids) then raise exception 'Selection changed, contains duplicates, or includes ineligible entries'; end if;
  insert into public.disposal_batches(id,site_id,disposed_date,disposed_by,notes,status)
    values(p_id,p_site_id,p_date,auth.uid(),p_notes,'pending');
  update public.waste_entries set disposal_batch_id=p_id where id=any(p_entry_ids);
  return p_id;
end $$;
revoke all on function public.create_disposal_request(uuid,uuid,date,uuid[],text) from public,anon;
grant execute on function public.create_disposal_request(uuid,uuid,date,uuid[],text) to authenticated;

create or replace function public.decide_disposal(p_batch_id uuid, p_site_id uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare batch public.disposal_batches;
begin
  perform 1 from public.sites where id=p_site_id for update;
  if auth.uid() is null or not public.is_site_admin_or_manager(auth.uid(),p_site_id) then raise exception 'Manager required' using errcode='42501'; end if;
  select * into batch from public.disposal_batches where id=p_batch_id and site_id=p_site_id for update;
  if not found or batch.status<>'pending' then raise exception 'Request missing or already decided'; end if;
  if batch.disposed_by=auth.uid() then raise exception 'A different manager must review the request'; end if;
  if p_action not in ('approve','reject') or p_action is null or length(p_reason)>5000 then raise exception 'Invalid decision'; end if;
  if p_action='approve' then
    if not exists(select 1 from public.waste_entries where disposal_batch_id=p_batch_id) then raise exception 'Empty disposal: select entries explicitly'; end if;
    if exists(select 1 from public.waste_entries where disposal_batch_id=p_batch_id and (site_id<>p_site_id or generated_date>batch.disposed_date)) then raise exception 'Invalid disposal selection'; end if;
    update public.disposal_batches set status='approved',approved_by=auth.uid(),approved_at=now() where id=p_batch_id;
  else
    update public.waste_entries set disposal_batch_id=null where disposal_batch_id=p_batch_id;
    update public.disposal_batches set status='rejected',approved_by=auth.uid(),approved_at=now(),rejection_reason=p_reason where id=p_batch_id;
  end if;
end $$;
revoke all on function public.decide_disposal(uuid,uuid,text,text) from public,anon;
grant execute on function public.decide_disposal(uuid,uuid,text,text) to authenticated;

-- Evidence metadata is bound to its real parent and object path.
create or replace function public.guard_photo() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare entry public.waste_entries; photo public.waste_entry_photos;
begin
  photo := coalesce(new,old);
  select * into entry from public.waste_entries where id=photo.waste_entry_id for update;
  if not found then
    if tg_op='DELETE' then return old; end if;
    raise exception 'Missing parent entry';
  end if;
  if entry.site_id<>photo.site_id then raise exception 'Photo site mismatch'; end if;
  if entry.disposal_batch_id is not null then raise exception 'Disposal evidence is locked'; end if;
  if tg_op='INSERT' then
    if photo.storage_path not like photo.site_id::text || '/' || photo.waste_entry_id::text || '/%' or photo.storage_path like '%..%' then raise exception 'Invalid photo path'; end if;
    if (select count(*) from public.waste_entry_photos where waste_entry_id=photo.waste_entry_id)>=10 then raise exception 'Maximum 10 photos per entry'; end if;
  end if;
  return photo;
end $$;
create trigger hardened_photo before insert or update or delete on public.waste_entry_photos for each row execute function public.guard_photo();
create policy current_member_photo_delete on public.waste_entry_photos as restrictive for delete to authenticated
using(public.has_site_access(auth.uid(),site_id));

-- Durable cleanup jobs; the Storage API worker deletes blobs after a committed metadata deletion.
create table public.photo_cleanup_jobs (
 id uuid primary key default gen_random_uuid(), storage_path text not null, site_id uuid not null,
 created_at timestamptz not null default now(), attempts integer not null default 0, last_error text
);
alter table public.photo_cleanup_jobs enable row level security;
revoke all on public.photo_cleanup_jobs from public,anon,authenticated;
grant all on public.photo_cleanup_jobs to service_role;
create function public.queue_photo_cleanup() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.photo_cleanup_jobs(storage_path,site_id) values(old.storage_path,old.site_id);
  update public.waste_entries set expected_photo_count=greatest(0,expected_photo_count-1) where id=old.waste_entry_id;
  return old;
end $$;
create trigger photo_cleanup after delete on public.waste_entry_photos for each row execute function public.queue_photo_cleanup();

create or replace function public.can_write_photo(p_path text) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s uuid; e uuid;
begin
  s:=split_part(p_path,'/',1)::uuid; e:=split_part(p_path,'/',2)::uuid;
  return public.has_site_access(auth.uid(),s) and exists(select 1 from public.waste_entries where id=e and site_id=s and disposal_batch_id is null and (created_by=auth.uid() or public.is_site_admin_or_manager(auth.uid(),s)));
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.can_write_photo(text) from public,anon;
grant execute on function public.can_write_photo(text) to authenticated;
create policy authorized_photo_insert on public.waste_entry_photos as restrictive for insert to authenticated
with check(public.can_write_photo(storage_path));
create policy hardened_photo_upload on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'waste-photos' or public.can_write_photo(name));
create policy hardened_photo_delete on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'waste-photos' or (public.can_write_photo(name) and not exists(select 1 from public.waste_entry_photos where storage_path=name)));
update storage.buckets set public=false, file_size_limit=26214400,
 allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id='waste-photos';

create or replace function public.write_audit_log() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare snapshot jsonb; site uuid;
begin
  if tg_op='DELETE' then snapshot:=to_jsonb(old); else snapshot:=to_jsonb(new); end if;
  site:=case when tg_table_name='sites' then (snapshot->>'id')::uuid else nullif(snapshot->>'site_id','')::uuid end;
  insert into public.audit_log(actor_id,table_name,action,row_id,site_id,snapshot)
  values(auth.uid(),tg_table_name,tg_op,(snapshot->>'id')::uuid,site,snapshot);
  return coalesce(new,old);
end $$;
create trigger audit_photos after insert or update or delete on public.waste_entry_photos for each row execute function public.write_audit_log();
create trigger audit_requests after insert or update or delete on public.site_access_requests for each row execute function public.write_audit_log();
create trigger audit_locations after insert or update or delete on public.site_locations for each row execute function public.write_audit_log();
create index if not exists waste_entries_site_date_idx on public.waste_entries(site_id,generated_date,id);
create index if not exists waste_entries_batch_idx on public.waste_entries(disposal_batch_id);
create index if not exists photos_entry_idx on public.waste_entry_photos(waste_entry_id);
create index if not exists requests_site_status_idx on public.site_access_requests(site_id,status);
create index if not exists audit_site_date_idx on public.audit_log(site_id,created_at);
create policy scoped_audit_only on public.audit_log as restrictive for select to authenticated
using(site_id is not null and public.is_site_admin_or_manager(auth.uid(),site_id));
create policy team_membership_reads on public.user_sites for select to authenticated
using(public.is_site_admin_or_manager(auth.uid(),site_id));
create policy team_role_reads on public.user_roles for select to authenticated
using(public.is_site_admin_or_manager(auth.uid(),site_id));
commit;
