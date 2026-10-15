import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseline='supabase/migrations/20250804000000_full_schema.sql';
writeFileSync(baseline,execFileSync('git',['show','HEAD:'+baseline],{encoding:'utf8'}));
function edit(path,fn){writeFileSync(path,fn(readFileSync(path,'utf8').replace(/\r\n/g,'\n')));}
edit('src/components/layout/InstallPrompt.tsx',s=>s.replace('      deferred = e as BeforeInstallPromptEvent;\n      if','      deferred = e as BeforeInstallPromptEvent;\n      setDeferred(deferred);\n      if'));
edit('public/manifest.webmanifest',s=>s.replace('/?action=new','/app?action=new'));
edit('src/components/auth/ProtectedRoute.tsx',s=>s.replace('import { Navigate }','import { Navigate, useLocation }').replace('  const { session, loading }','  const location = useLocation();\n  const { session, loading }').replace('to="/auth"','to={"/auth" + location.search}'));
edit('src/pages/Auth.tsx',s=>s.replace('Navigate, useNavigate','Navigate, useNavigate, useLocation').replace('  const navigate = useNavigate();','  const navigate = useNavigate();\n  const location = useLocation();\n  const destination = "/app" + location.search;').replace('to="/app"','to={destination}').replace('navigate("/app")','navigate(destination)'));
edit('src/App.tsx',s=>s.replace('Routes, Navigate','Routes, Navigate, useLocation').replace('const App =', 'function EntryRedirect() { const location = useLocation(); return <Navigate to={"/app" + location.search} replace />; }\n\nconst App =').replace('<Navigate to="/app" replace />','<EntryRedirect />'));
edit('src/pages/Index.tsx',s=>s.replace('  const [editEntry, setEditEntry]',`  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setDrawerOpen(true);
      const next = new URLSearchParams(searchParams); next.delete("action"); setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [editEntry, setEditEntry]`));
edit('src/hooks/useEntryPhotos.ts',s=>{
 s='import { useAuth } from "@/contexts/AuthContext";\nimport { readAll } from "@/lib/pagination";\n'+s;
 s=s.replace('  return useQuery({','  const { user } = useAuth();\n  return useQuery({');
 s=s.replace('["waste_entry_photos", entryId]','["waste_entry_photos", user?.id, entryId]').replace('["waste_entry_photo_counts", entryIds]','["waste_entry_photo_counts", user?.id, entryIds]');
 s=s.replace('    staleTime: 55 * 60_000,','    staleTime: 50 * 60_000,\n    refetchInterval: 50 * 60_000,\n    refetchOnWindowFocus: true,');
 s=s.replace('(data as any[]).map((r: any)', 'data.map((r)').replace('(data as any[]).map((r: any, i: number)', 'data.map((r, i)');
 const a=s.indexOf('      const { data, error } = await supabase',s.indexOf('export function useEntryPhotoCounts'));
 const b=s.indexOf('      const counts:',a);
 s=s.slice(0,a)+`      const data: { waste_entry_id: string }[] = [];
      for (let offset = 0; offset < entryIds.length; offset += 100) {
        data.push(...await readAll((from, to) => supabase.from("waste_entry_photos").select("waste_entry_id")
          .in("waste_entry_id", entryIds.slice(offset, offset + 100)).order("id").range(from, to)));
      }
`+s.slice(b);
 s=s.replace('      const { error: sErr } = await supabase.storage.from("waste-photos").remove([photo.storage_path]);\n      if (sErr) throw new Error(sErr.message);\n','');
 return s.replace('.delete().eq("id", photo.id);','.delete().eq("id", photo.id).select("id").single();');
});
edit('.gitignore',s=>s+'\n# Secrets and production data must not enter commits\n.env*\n!.env.example\ndocs/*Rows*.csv\nscripts/data/*.csv\n');
