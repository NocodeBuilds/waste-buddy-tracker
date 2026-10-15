import { spawn } from 'node:child_process';
// Explicitly replace every backend variable. Browser regression tests never use production.
const env={...process.env,VITE_SUPABASE_URL:'https://fixture.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-key',VITE_SUPABASE_ANON_KEY:'test-public-key'};
const run=(args)=>spawn(process.execPath,['node_modules/vite/bin/vite.js',...args],{env,stdio:'inherit',windowsHide:true});
const build=run(['build','--outDir','.test-dist']);
build.on('exit',code=>{
 if(code){process.exitCode=code;return;}
 const preview=run(['preview','--outDir','.test-dist','--host','127.0.0.1','--port','8181','--strictPort']);
 process.on('SIGTERM',()=>preview.kill());process.on('SIGINT',()=>preview.kill());
 preview.on('exit',code=>{process.exitCode=code ?? 0;});
});
