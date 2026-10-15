import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
for(const name of readdirSync('tests').filter(n=>n.endsWith('.ts'))){
 const path='tests/'+name;let s=readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 s=s.replace(/try \{ (mkdirSync\([^\n]+?\);) \} catch \(e\) \{\}/g,'$1');
 s=s.replace(/  test.beforeEach\(async \(\{ context \}\) => \{[\s\S]*?extendStorageState[\s\S]*?\n  \}\);\n/g,'');
 s=s.replaceAll('catch (e: any)','catch (e: unknown)').replaceAll('e?.message?.includes','(e instanceof Error ? e.message : "").includes');
 s=s.replace('page: any','page: import("@playwright/test").Page').replaceAll('(e as any).transferSize','(e as PerformanceResourceTiming).transferSize');
 s=s.replace('const fields: any[]','const fields: { tag: string; type: string; id: string; placeholder: string; visible: boolean }[]').replace('(f: any, i: number)','(f, i: number)');
 s=s.replace('const results: any[]','const results: Record<string, unknown>[]').replace('const info: any','const info: Record<string, unknown>').replace('const result: any = {};','const result: Record<string, unknown> = {};');
 s=s.replace('const result: any = {','const result: {viewport: {w:number;h:number};header: {top:number;h:number;w:number;visible:boolean}|null;tabBar: {top:number;h:number;w:number;visible:boolean}|null;bottomNav: {top:number;h:number;w:number;visible:boolean}|null;allFixed: Record<string,unknown>[];overlapped: Record<string,unknown>[];visibleHeader:boolean;visibleTabBar:boolean;visibleBottomNav:boolean} = {');
 writeFileSync(path,s);
}
const config=JSON.parse(readFileSync('package.json','utf8'));
config.scripts['test:database']='node scripts/test-database.mjs';
config.scripts['test:pwa']='playwright test --config playwright.security.config.ts';
writeFileSync('package.json',JSON.stringify(config,null,2)+'\n');
