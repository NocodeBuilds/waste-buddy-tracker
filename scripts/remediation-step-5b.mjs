import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
function edit(path,fn){const old=readFileSync(path,'utf8').replace(/\r\n/g,'\n');const next=fn(old);if(next===old)throw new Error('No edit: '+path);writeFileSync(path,next);}
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
