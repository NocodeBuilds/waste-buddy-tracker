#!/usr/bin/env bash
# 02_import_data.sh — load the exported CSVs into YOUR Supabase project.
#
# Usage:
#   export PGURI="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#   ./02_import_data.sh
#
# Run AFTER 01_schema.sql and AFTER 03_migrate_auth_users.mjs
# (rows reference auth.users, so the users must exist first).

set -euo pipefail
cd "$(dirname "$0")/data"

if [ -z "${PGURI:-}" ]; then echo "Set PGURI first"; exit 1; fi

# Audit triggers would double-log the import; disable them during load.
psql "$PGURI" -c "alter table public.sites disable trigger audit_sites;
                  alter table public.sites disable trigger on_site_created;
                  alter table public.user_sites disable trigger audit_user_sites;
                  alter table public.user_roles disable trigger audit_user_roles;
                  alter table public.waste_entries disable trigger audit_waste_entries;
                  alter table public.disposal_batches disable trigger audit_disposal_batches;"

# Order matters (foreign keys).
for t in sites profiles site_locations user_sites user_roles site_access_requests \
         disposal_batches waste_entries waste_entry_photos audit_log; do
  echo "-> $t"
  psql "$PGURI" -c "\copy public.$t from '$t.csv' with (format csv, header true)"
done

psql "$PGURI" -c "alter table public.sites enable trigger audit_sites;
                  alter table public.sites enable trigger on_site_created;
                  alter table public.sites enable trigger audit_sites;
                  alter table public.user_sites enable trigger audit_user_sites;
                  alter table public.user_roles enable trigger audit_user_roles;
                  alter table public.waste_entries enable trigger audit_waste_entries;
                  alter table public.disposal_batches enable trigger audit_disposal_batches;"

echo "Done. Row counts:"
psql "$PGURI" -c "select 'sites' t,count(*) from sites union all
                  select 'profiles',count(*) from profiles union all
                  select 'waste_entries',count(*) from waste_entries union all
                  select 'waste_entry_photos',count(*) from waste_entry_photos union all
                  select 'site_locations',count(*) from site_locations;"
