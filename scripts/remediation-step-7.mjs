import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
function edit(path,fn){writeFileSync(path,fn(readFileSync(path,'utf8').replace(/\r\n/g,'\n')));}
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(dir+'/'+d.name):[dir+'/'+d.name]);}
// Let typed Supabase queries infer their callback rows; handle caught errors as unknown.
for(const path of files('src').filter(p=>/\.(ts|tsx)$/.test(p))){edit(path,s=>{
 s=s.replace(/\((\w+): any\) =>/g,'($1) =>').replace(/\(([be]|wt|group\.wt) as any\)/g,'$1').replace(/\(\{ data \}: any\)/g,'({ data })');
 if(/catch \((\w+): any\)/.test(s)){
  s='import { errorMessage } from "@/lib/validation";\n'+s;
  s=s.replace(/catch \((\w+): any\)/g,'catch ($1: unknown)').replace(/(err|e)\.message \?\? "[^"]*"/g,'errorMessage($1)');
 }
 return s.replaceAll('let profMap:', 'const profMap:');
});}
edit('src/components/admin/UserManagementView.tsx',s=>{
 s='import { useQuery } from "@tanstack/react-query";\nimport { loadTeam, DisplayRequest } from "@/lib/adminData";\nimport { errorMessage } from "@/lib/validation";\n'+s;
 s=s.replace('  const [members, setMembers] = useState<Member[]>([]);\n  const [requests, setRequests] = useState<any[]>([]);\n  const [loading, setLoading] = useState(true);',`  const team = useQuery({ queryKey: ["members", callerId, siteId], queryFn: () => loadTeam(siteId), enabled: siteId !== "ALL_SITES" });
  const members = team.data?.members ?? [];
  const requests = team.data?.requests ?? [];
  const loading = team.isLoading;
  const load = async () => { await team.refetch(); };`);
 const a=s.indexOf('  const load = async () => {\n    setLoading'),b=s.indexOf('  const handleCreateAccount',a);
 s=s.slice(0,a)+`  const call = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ok?: boolean; error?: string}>("admin-manage-user", { body });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Operation failed");
      toast.success(success); await load(); return true;
    } catch (error) { toast.error(errorMessage(error)); return false; }
    finally { setBusy(false); }
  };

`+s.slice(b);
 s=s.replace('const approveReq = async (r: any)','const approveReq = async (r: DisplayRequest)').replace('const rejectReq = async (r: any)','const rejectReq = async (r: DisplayRequest)');
 return s.replace('    <div className="space-y-3">','    <div className="space-y-3">\n      {team.error && <p role="alert" className="text-destructive">{team.error.message}</p>}');
});
edit('src/components/admin/RecordsOversightView.tsx',s=>{
 s='import { useQuery, useQueryClient } from "@tanstack/react-query";\nimport { useAuth } from "@/contexts/AuthContext";\nimport { readAll } from "@/lib/pagination";\n'+s;
 s=s.replace('  const [rows, setRows] = useState<any[]>([]);\n  const [loading, setLoading] = useState(true);',`  const { user } = useAuth();
  const qc = useQueryClient();
  const records = useQuery({ queryKey: ["waste_entries", "oversight", user?.id, siteId], enabled: !!user && siteId !== "ALL_SITES",
    queryFn: () => readAll((from,to) => supabase.from("waste_entries").select("*").eq("site_id",siteId).order("created_at", {ascending:false}).order("id").range(from,to)) });
  const rows = records.data ?? [];
  const loading = records.isLoading;`);
 const a=s.indexOf('  const load = async'),b=s.indexOf('  const del = async',a);s=s.slice(0,a)+s.slice(b);
 return s.replace('.delete().eq("id", id);','.delete().eq("id", id).eq("site_id", siteId).select("id").single();')
 .replace('    setRows((prev) => prev.filter((r) => r.id !== id));','    await qc.invalidateQueries({queryKey:["waste_entries"]});\n    await qc.invalidateQueries({queryKey:["audit_log"]});')
 .replace('Records Oversight (100 Max)','Records Oversight').replace('          {loading ? (','          {records.error && <p role="alert">{records.error.message}</p>}\n          {loading ? (');
});
edit('src/components/admin/AuditTrailView.tsx',s=>{
 s='import { useQuery } from "@tanstack/react-query";\nimport { useAuth } from "@/contexts/AuthContext";\nimport { Button } from "@/components/ui/button";\n'+s;
 const a=s.indexOf('export default function AuditTrailView'),b=s.indexOf('\n  return (',a);
 s=s.slice(0,a)+`export default function AuditTrailView({ siteId }: { siteId: string }) {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [siteId]);
  const query = useQuery({queryKey:["audit_log",user?.id,siteId,page],enabled:!!user && siteId !== "ALL_SITES",queryFn:async()=>{
    const {data,error}=await supabase.from("audit_log").select("*").eq("site_id",siteId).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99);
    if(error) throw new Error(error.message);
    return data;
  }});
  const rows = query.data ?? [];
  const loading = query.isLoading;
  const profiles: Record<string,string> = {};
`+s.slice(b);
 s=s.replace('        {loading ? (','        {query.error && <p role="alert">{query.error.message}</p>}\n        <div className="flex gap-2"><Button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page + 1}</span><Button disabled={rows.length < 100} onClick={() => setPage(p => p + 1)}>Next</Button></div>\n        {loading ? (').replace('variant={actionBadge as any}','variant={actionBadge}');
 return s;
});
edit('src/components/admin/AdminTab.tsx',s=>s.replace('  const isAdmin = siteIsAdmin || isAuthAdmin;','  const isAdmin = siteIsAdmin;').replace('if (!isAdmin || !currentSite)','if (!isAdmin || !currentSite || currentSite.id === "ALL_SITES")').replace('<AuditTrailView />','<AuditTrailView siteId={currentSite.id} />'));
edit('src/components/inventory/ExportOptionsDialog.tsx',s=>s.replace('import { DisposalBatch,','import { WasteEntry, DisposalBatch,').replaceAll('any[]','WasteEntry[]'));
edit('src/components/analytics/AnalyticsTab.tsx',s=>s.replace('payload?: any[]','payload?: { payload?: { fullRange: string; isCurrentWeek?: boolean; isToday?: boolean; kg: number; litres: number; count: number } }[]'));
edit('src/components/analytics/PredictiveWasteForecast.tsx',s=>s.replace('formatter={(val: any, name: string)','formatter={(val, name: string)'));
edit('src/components/layout/InstallPrompt.tsx',s=>s.replace('(window.navigator as any)','(window.navigator as Navigator & { standalone?: boolean })'));
edit('src/pages/ResetPassword.tsx',s=>s.replace('(evt: string, session: any)','(evt, session)'));
edit('src/lib/wasteExports.ts',s=>s.replace('import autoTable from','import autoTable, { RowInput } from').replaceAll('(doc as any)','(doc as jsPDF & { lastAutoTable?: { finalY: number } })').replace('tableData: any[]','tableData: RowInput[]'));
edit('src/components/ui/command.tsx',s=>s.replace('interface CommandDialogProps extends DialogProps {}','type CommandDialogProps = DialogProps;'));
edit('src/components/ui/textarea.tsx',s=>s.replace('export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}','export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;'));
edit('tailwind.config.ts',s=>'import animate from "tailwindcss-animate";\n'+s.replace('require("tailwindcss-animate")','animate'));
edit('src/contexts/SiteContext.tsx',s=>s.replace('let sites:Site[],roles:Record<string,Role[]>={};','let sites:Site[]; const roles:Record<string,Role[]>={};'));
// Preserve private dumps locally while removing personal/operational records from tracked artifacts.
mkdirSync('.private-audit-backup',{recursive:true});
for(const dir of ['docs','scripts/data']) for(const name of readdirSync(dir).filter(n=>n.endsWith('.csv'))){
 const path=dir+'/'+name, data=readFileSync(path,'utf8');
 writeFileSync('.private-audit-backup/'+dir.replace('/','-')+'-'+name,data);
 writeFileSync(path,data.split(/\r?\n/)[0]+'\n');
}
edit('.gitignore',s=>s+'\n.private-audit-backup/\n');
