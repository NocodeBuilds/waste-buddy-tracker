import { readFileSync, writeFileSync } from 'node:fs';
function edit(path,fn){writeFileSync(path,fn(readFileSync(path,'utf8').replace(/\r\n/g,'\n')));}
// Build the database catalogue from the existing application catalogue; no legacy rows are rewritten.
const source=readFileSync('src/lib/wasteTypes.ts','utf8');
const rows=[...source.matchAll(/\{ id: "([^"]+)"[^\n]+wasteCategory: "([^"]+)"/g)].map(m=>`('${m[1]}','${m[2]}')`);
if(rows.length<30)throw new Error('Incomplete catalogue');
edit('supabase/migrations/20261014000000_preserve_users_security_hardening.sql',s=>s.replace('-- Status transitions',`create table if not exists public.waste_type_catalog(id text primary key, category public.waste_category not null);
alter table public.waste_type_catalog enable row level security;
grant select on public.waste_type_catalog to authenticated;
create policy catalog_read on public.waste_type_catalog for select to authenticated using(true);
insert into public.waste_type_catalog(id,category) values ${rows.join(',\n')} on conflict do nothing;

-- Status transitions`).replace('  if tg_op=\'UPDATE\' and (new.site_id',`  if tg_op='INSERT' or new.waste_type_id is distinct from old.waste_type_id or new.waste_category is distinct from old.waste_category then
    if not exists(select 1 from public.waste_type_catalog where id=new.waste_type_id and category=new.waste_category) then raise exception 'Unknown waste type or category mismatch'; end if;
  end if;
  if tg_op='UPDATE' and (new.site_id`));
edit('src/components/inventory/EditWasteDialog.tsx',s=>s.replace('setDate(clampDateNotFuture(entry.generated_date))','setDate(entry.generated_date)').replace('const w = parseFloat(weight);','const w = Number(weight);').replace('!typeId || !w || w <= 0 || !date','!typeId || !Number.isFinite(w) || w <= 0 || w > 1e9 || !date').replace('      setDate(safeDate);','      toast.error("Generation date cannot be in the future"); return;').replace('    setSaving(true);','    if (pieceCount && (!Number.isInteger(Number(pieceCount)) || Number(pieceCount) < 0)) { toast.error("Piece count must be a non-negative integer"); return; }\n    setSaving(true);'));
edit('src/components/inventory/DisposalHistoryView.tsx',s=>s.replace('import { useState }','import { useAuth } from "@/contexts/AuthContext";\nimport { useSite } from "@/contexts/SiteContext";\nimport { useState }').replace('  const [rejectingId','  const { user } = useAuth();\n  const { sites, rolesBySite } = useSite();\n  const [rejectingId').replace('          {filteredBatches.map((b) => {','          {filteredBatches.map((b) => {\n            const batchSiteName = sites.find(s => s.id === b.site_id)?.name ?? currentSiteName;\n            const mayDecide = (rolesBySite[b.site_id] ?? []).some(role => role === "admin" || role === "manager") && b.disposed_by !== user?.id;').replace('`All active entries (${allActiveEntries.length}) pending approval`','"No entries selected — this batch cannot be approved"').replace('isPending && isManagerOrAdmin && onApproveDisposal','isPending && mayDecide && onApproveDisposal').replace('exportDisposalBatchPdf(b, inBatch, currentSiteName)','exportDisposalBatchPdf(b, inBatch, batchSiteName)'));
// Lazy chunks keep PDF/spreadsheet exporters and analytics off the initial authentication path.
edit('src/pages/Index.tsx',s=>{
 s=s.replace('import { useEffect,','import { lazy, Suspense, useEffect,');
 for(const [name,path] of [['AnalyticsTab','@/components/analytics/AnalyticsTab'],['AdminTab','@/components/admin/AdminTab'],['SettingsTab','@/components/settings/SettingsTab']])
 s=s.replace(`import ${name} from "${path}";`,`const ${name} = lazy(() => import("${path}"));`);
 return s.replace('          {isLoading || siteLoading ? (','          <Suspense fallback={<p role="status">Loading view…</p>}>\n          {isLoading || siteLoading ? (').replace('        </main>','          </Suspense>\n        </main>');
});
edit('src/components/inventory/WasteInventoryTable.tsx',s=>{
 const a=s.indexOf('import {\n  export'),b=s.indexOf('} from "@/lib/wasteExports";',a);
 if(a>=0 && b>a){const names=s.slice(a,b).replace('import {','').trim();s=s.slice(0,a)+s.slice(b+'} from "@/lib/wasteExports";'.length);
 s=s.replace('const handleExport = (opts:', 'const handleExport = async (opts:').replace('  }) => {\n    if (opts.format',`  }) => {
    const { ${names} } = await import("@/lib/wasteExports");
    if (opts.format`);}
 return s;
});
edit('src/components/inventory/DisposalHistoryView.tsx',s=>s.replace('import { exportDisposalBatchPdf } from "@/lib/wasteExports";','').replace('onClick={() => exportDisposalBatchPdf(b, inBatch, batchSiteName)}','onClick={async () => { const { exportDisposalBatchPdf } = await import("@/lib/wasteExports"); exportDisposalBatchPdf(b, inBatch, batchSiteName); }}'));
edit('src/contexts/AuthContext.tsx',s=>s.replace('if(key.startsWith("wastebuddy_entries_")','if(key.startsWith("wastebuddy:v2:")||key.startsWith("wastebuddy_entries_")'));
edit('src/components/auth/RequestSiteAccess.tsx',s=>s.replace('.select("id, name, location").order("name")','.select("id, name, location").is("archived_at", null).order("name")').replace('Access request submitted — site admin will be notified','Access request submitted — it is available in the site administrator’s request list').replace('.delete().eq("id", id);','.delete().eq("id", id).select("id").single();'));
