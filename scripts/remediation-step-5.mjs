import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
function edit(path,fn){const old=readFileSync(path,'utf8').replace(/\r\n/g,'\n');const next=fn(old);if(next===old)throw new Error('No edit: '+path);writeFileSync(path,next);}
edit('src/hooks/useSiteLocations.ts',s=>s.replace('import { useQuery }','import { useAuth } from "@/contexts/AuthContext";\nimport { useQuery }').replace('useSiteLocations()','useSiteLocations(targetSiteId?: string)').replace('  const siteId = currentSite?.id;','  const { user } = useAuth();\n  const siteId = targetSiteId ?? currentSite?.id;').replace('["site_locations", siteId]','["site_locations", user?.id, siteId]').replace('enabled: !!siteId','enabled: !!user && !!siteId && siteId !== "ALL_SITES"'));
edit('src/lib/offlineSync.ts',s=>s.replace('id=crypto.randomUUID()','id:string=crypto.randomUUID()').replace('syncing=(navigator.locks ? navigator.locks.request("wastebuddy-outbox-sync",run) : run()).finally','syncing=Promise.resolve(navigator.locks ? navigator.locks.request("wastebuddy-outbox-sync",run) : run()).then(value => value).finally').replace(' return syncing;\n}', ' return syncing!;\n}'));
edit('src/hooks/useWasteEntries.ts',s=>s.replace('queryFn:async()=>{','queryFn:async():Promise<WasteEntry[]>=>{'));
edit('src/lib/wasteTypes.ts',s=>s.replace('if (entry.disposal_batch_id) return "safe";','if (isDisposed(entry)) return "safe";'));
edit('src/components/inventory/WasteEntryForm.tsx',s=>s.replace('photoUrls[i]','photoUrls[idx]').replace('  const [customLocation, setCustomLocation] = useState("");','  const [customLocation, setCustomLocation] = useState("");\n  useEffect(() => { setLocation(""); setCustomLocation(""); }, [targetSiteId]);'));
edit('src/pages/Index.tsx',s=>s.replace('onCreateDisposal={(p) => createDisposalBatch.mutateAsync({ ...p, siteId: (p as any).siteId || currentSite?.id || "" })}','onCreateDisposal={async (p) => { await createDisposalBatch.mutateAsync(p); }}'));
edit('src/components/inventory/WasteInventoryTable.tsx',s=>s.replace('onCreateDisposal: (params: { disposed_date: string;','onCreateDisposal: (params: { siteId: string; operationId?: string; disposed_date: string;').replace('    selectedFy: number;\n  }) => {','    selectedFy: number;\n    form8Mode?: "summary" | "per_entry";\n  }) => {').replace('const chosenIds = disposalScope === "selected" ? Array.from(selectedForDisposal) : undefined;',`const targetSite = isAllSitesMode ? sites.find(s => s.id === selectedFacilityId) : currentSite;
      if (!targetSite) throw new Error("Choose one facility before submitting a disposal");
      const eligible = allActiveEntries.filter(e => e.site_id === targetSite.id && !e.disposal_batch_id && !e.sync_pending);
      const chosenIds = disposalScope === "selected" ? eligible.filter(e => selectedForDisposal.has(e.id)).map(e => e.id) : eligible.map(e => e.id);`).replace('      await onCreateDisposal({','      await onCreateDisposal({\n        siteId: targetSite.id,').replace('    setExportFormat(fmt);','    if (isAllSitesMode && selectedFacilityId === "all") { toast.error("Choose a facility before exporting its records"); return; }\n    setExportFormat(fmt);').replace('  const handleExport = (opts:', '  const exportSite = isAllSitesMode ? sites.find(s => s.id === selectedFacilityId) : currentSite;\n  const exportEntries = entries.filter(e => e.site_id === exportSite?.id);\n  const exportBatches = batches.filter(b => b.site_id === exportSite?.id);\n  const handleExport = (opts:').replaceAll('currentSite?.name ?? "Site"','exportSite?.name ?? "Site"').replace('exportForm4AnnualReturnPdf(entries, batches,','exportForm4AnnualReturnPdf(exportEntries, exportBatches,').replace('        entries={entries}\n        batches={batches}\n        onExport={handleExport}','        entries={exportEntries}\n        batches={exportBatches}\n        onExport={handleExport}'));
edit('src/components/settings/SettingsTab.tsx',s=>{
 const a=s.indexOf('  const sanitizeCsv ='),b=s.indexOf('\n  const handleExport',a);
 return 'import { csvCell as sanitizeCsv } from "@/lib/csv";\n'+s.slice(0,a)+s.slice(b);
});
edit('src/components/admin/FacilitiesManagementView.tsx',s=>s.replace('.eq("id", renameTarget.id);','.eq("id", renameTarget.id).select("id").single();').replace('.from("sites").delete().eq("id", deleteTarget.id);','.from("sites").update({ archived_at: new Date().toISOString() }).eq("id", deleteTarget.id).select("id").single();').replace('Site deleted','Site archived').replaceAll('Delete Facility','Archive Facility').replace('permanently delete','archive').replace('This will delete the facility and all associated data. This action cannot be undone.','This hides the facility from active lists. Existing records and memberships are retained.'));
edit('src/lib/wasteExports.ts',s=>s.replace('SPCB/HOWM/${safeName(siteName)}/REG','NOT PROVIDED — DRAFT').replace('"Authorized TSDF / Recycler"','"Recipient not recorded — verify before filing"').replace('const dispDateStr = e.disposal_batch_id ?','const dispDateStr = isDisposed(e) && e.disposal_batch_id ?'));
edit('index.html',s=>s.replace(', user-scalable=no',''));
edit('src/components/layout/InstallPrompt.tsx',s=>s.replace('      if (!visibleSet) {\n        setDeferredPrompt(e as BeforeInstallPromptEvent);','      setDeferredPrompt(e as BeforeInstallPromptEvent);\n      if (!visibleSet) {'));
edit('src/pages/AdminAuth.tsx',s=>s.replace('  // Lazily check admin_exists',`  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setTimeout(() => setResetCooldown(c => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resetCooldown]);
  // Lazily check admin_exists`).replace('    const timer = setInterval(() => setResetCooldown(c => c - 1), 1000);','').replace('    clearInterval(timer);','').replace('    await checkAdminExists();\n    setMode("bootstrap");','    toast.info("First administrator setup requires the deployment operator. Existing administrators can sign in above.");'));
// Keep migration versions, but make historical schema replays idempotent. Never replay reset DML.
for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&!n.startsWith('20261014'))){
 let s=readFileSync('supabase/migrations/'+name,'utf8');
 if(name.startsWith('20260617152902')||name.startsWith('20260620170350')) s='-- Historical account/data reset retired. Intentionally a no-op; preserve migration version.\n';
 if(name.startsWith('20260619160738')) s=s.slice(s.indexOf('-- 2)'));
 s=s.replace(/CREATE TYPE (public\.\w+) AS ENUM\s*(\([^;]+\));/gi,(whole)=>'DO $$ BEGIN '+whole+' EXCEPTION WHEN duplicate_object THEN NULL; END $$;');
 s=s.replace(/CREATE TABLE (?!IF NOT EXISTS)/gi,'CREATE TABLE IF NOT EXISTS ');
 s=s.replace(/CREATE INDEX (?!IF NOT EXISTS)/gi,'CREATE INDEX IF NOT EXISTS ');
 s=s.replace(/CREATE POLICY ("[^"]+"|\w+)\s+ON ([\w.]+)/gi,(whole,name,table)=>'DROP POLICY IF EXISTS '+name+' ON '+table+';\n'+whole);
 s=s.replace(/CREATE TRIGGER (\w+)([\s\S]*?) ON ([\w.]+)\s+/gi,(whole,name,middle,table)=>'DROP TRIGGER IF EXISTS '+name+' ON '+table+';\n'+whole);
 writeFileSync('supabase/migrations/'+name,s);
}
