import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public,auth,storage to authenticated,anon,service_role;
grant select,insert,delete on storage.objects to authenticated;
insert into storage.buckets(id,public) values('waste-photos',false);
`);
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
try {
 for(const file of files){
  // pgcrypto is provided by Supabase; PGlite has core gen_random_uuid, but no pgcrypto extension.
  const sql=readFileSync('supabase/migrations/'+file,'utf8').replace(/create extension if not exists pgcrypto;/ig,'');
  await db.exec(sql); console.log('PASS migration '+file);
  if(file.startsWith('20250804')) {
   await db.exec(`insert into auth.users(id,email) values('90000000-0000-4000-8000-000000000001','legacy@example.test');
    insert into sites(id,name) values('90000000-0000-4000-8000-000000000002','Legacy fixture');
    insert into user_sites(user_id,site_id) values('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002');
    insert into user_roles(user_id,site_id,role) values('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','admin');
    insert into disposal_batches(id,site_id,disposed_date) values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','2025-01-01');`);
  }
 }
 const preserved = await db.query(`select count(*)::int n from user_roles where user_id='90000000-0000-4000-8000-000000000001' and role='admin'`);
 assert.equal(preserved.rows[0].n,1);
 const legacyBatch = await db.query(`select status from disposal_batches where id='90000000-0000-4000-8000-000000000003'`);
 assert.equal(legacyBatch.rows[0].status,'approved');
 console.log('PASS legacy administrator, membership and completed disposal preserved through full replay');
 const u='10000000-0000-4000-8000-000000000001',m='10000000-0000-4000-8000-000000000002',v='10000000-0000-4000-8000-000000000003';
 const s='20000000-0000-4000-8000-000000000001',t='20000000-0000-4000-8000-000000000002';
 const e='30000000-0000-4000-8000-000000000001',b='40000000-0000-4000-8000-000000000001';
 await db.exec(`insert into auth.users(id,email) values('${u}','admin@example.test'),('${m}','manager@example.test'),('${v}','member@example.test');
 insert into sites(id,name) values('${s}','Synthetic A'),('${t}','Synthetic B');
 insert into user_sites(user_id,site_id) values('${u}','${s}'),('${m}','${s}'),('${v}','${s}');
 insert into user_roles(user_id,site_id,role) values('${u}','${s}','admin'),('${m}','${s}','manager'),('${v}','${s}','member');`);
 const actor=async id=>{await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${id}';`);};
 const denied=async(sql,label)=>{await assert.rejects(()=>db.exec(sql),undefined,label);console.log('PASS denied '+label);};
 await actor(v);
 await denied(`insert into sites(name) values('Escalation')`,'member site creation');
 await denied(`insert into user_roles(user_id,site_id,role) values('${v}','${s}','admin')`,'direct admin grant');
 await denied(`update profiles set email='admin@example.test' where id='${v}'`,'editable identity email');
 await denied(`insert into waste_entries(id,site_id,waste_type_id,weight_kg,generated_date,activity_type,created_by) values('${e}','${s}','oil-cotton',-1,current_date,'preventive','${v}')`,'negative weight');
 await db.exec(`insert into waste_entries(id,site_id,waste_type_id,weight_kg,generated_date,activity_type,created_by) values('${e}','${s}','oil-cotton',10,current_date,'preventive','${v}')`);
 await denied(`select create_disposal_request('${b}','${s}',current_date,array['${e}']::uuid[])`,'member disposal');
 await actor(u);
 await denied(`select manage_site_access('revoke_role','${s}','${u}','admin')`,'last administrator removal');
 await denied(`select manage_site_access('assign','${s}','${v}','admin')`,'unreviewed admin promotion');
 await denied(`select create_disposal_request('${b}','${t}',current_date,array['${e}']::uuid[])`,'cross-site disposal');
 await db.exec(`select create_disposal_request('${b}','${s}',current_date,array['${e}']::uuid[])`);
 await denied(`update disposal_batches set status='approved' where id='${b}'`,'direct approval');
 await denied(`select decide_disposal('${b}','${s}','approve')`,'self approval');
 await actor(m);
 await db.exec(`select decide_disposal('${b}','${s}','approve')`);
 await denied(`update waste_entries set weight_kg=20 where id='${e}'`,'editing finalized evidence');
 await denied(`delete from waste_entries where id='${e}'`,'deleting finalized evidence');
 await db.exec('reset role');
 const result=await db.query('select count(*)::int n from auth.users');assert.equal(result.rows[0].n,4);
 const audit=await db.query(`select actor_id from audit_log where table_name='disposal_batches' and action='UPDATE' order by created_at desc limit 1`);
 assert.equal(audit.rows[0].actor_id,m);
 console.log('PASS preserved users, approved disposal, and authenticated audit actor');
} catch(error){console.error('FAIL',error.message);process.exitCode=1;}
finally {await db.close();}
